/***********************
 * ASAP e-commerce script
 * - Product data (edit below)
 * - Cart logic: add, remove, totals
 * - Checkout via Paystack
 * - (Optional) Save orders to Firebase Firestore
 ***********************/

/* ---------- CONFIG (EDIT THESE) ---------- */

// Replace with your Paystack public key (test or live depending on environment)
const PAYSTACK_PUBLIC_KEY = "pk_live_c61d69f1950337bd79d1b181835c4bf3a4b747cd";

// If you want to save orders, create Firebase project and paste config here.
// OPTIONAL: If you don't use firebase, set SAVE_ORDERS = false
const SAVE_ORDERS = false;
const FIREBASE_CONFIG = {
  apiKey: "YOUR_FIREBASE_APIKEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};

/* ---------- INITIALIZATION ---------- */
document.getElementById("year").innerText = new Date().getFullYear();
let cart = [];
let total = 0;

/* Initialize Firebase if enabled */
if (SAVE_ORDERS) {
  if (!FIREBASE_CONFIG.apiKey) {
    console.warn("Firebase config missing. Disable SAVE_ORDERS or add config.");
  } else {
    firebase.initializeApp(FIREBASE_CONFIG);
    window.db = firebase.firestore();
  }
}

/* ---------- PRODUCT LIST (edit with your real products + image URLs) ---------- */
/* For each product: id, name, price (in Naira), imageURL, description, sku */
const PRODUCTS = [
  {
    id: "asap-tanktop",
    name: "ASAP Tanktop -- Green, Black, White, Skyblue",
    price: 25000,
    image: "https://imgur.com/a/BViTK1s",
    desc: "even during the summer, you gotta pray"
  },
  {
    id: "asap-tanktop",
    name: "ASAP Seamless Crop TankTop for the ladies -- Black, White ",
    price: 20000,
    image: "https://imgur.com/a/o80YQI0",
    desc: "your body is the temple of God"
  },
  {
    id: "asap-armless",
    name: "ASAP Washout Armless -- Brown, Ash, Navy Blue, Black",
    price: 35000,
    image: "https://imgur.com/a/EaOSrPG",
    desc: "something special"
  },
  {
    id: "asap tees",
    name: "ASAP Washout Tess -- Black, Milk, Ash, Pink & Purple",
    price: 45000,
    image: "https://imgur.com/a/uhsrOAd",
    desc: "let you dress speak for itself"
  },
  {
    id: "asap classic",
    name: "ASAP Unisex Vintage Shoulder Tote Bags - Off white and black",
    price: 15000,
    image: "https://imgur.com/a/eqx8Eap",
    desc: "carry a prayer in your hands"
  },
];

/* ---------- RENDER PRODUCTS ---------- */
function renderProducts() {
  const container = document.getElementById("products");
  container.innerHTML = "";
  PRODUCTS.forEach(p => {
    const card = document.createElement("div");
    card.className = "product";
    card.innerHTML = `
      <img src="${p.image}" alt="${escapeHtml(p.name)}" />
      <div class="info">
        <h3>${escapeHtml(p.name)}</h3>
        <p>₦${formatNumber(p.price)}</p>
      </div>
      <div class="add">
        <small style="color:#777">${escapeHtml(p.desc)}</small>
        <button class="btn primary" onclick="addToCart('${p.id}')">Add</button>
      </div>
    `;
    container.appendChild(card);
  });
}

/* ---------- CART LOGIC ---------- */
function addToCart(productId) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return alert("Product not found.");
  cart.push({ ...product }); // simple: duplicates allowed; extend later for qty control
  total += product.price;
  updateCartUI();
}

function updateCartUI() {
  document.getElementById("cart-count").innerText = cart.length;
  const list = document.getElementById("cart-items");
  list.innerHTML = "";
  cart.forEach((item, idx) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>${escapeHtml(item.name)}</span>
      <span>₦${formatNumber(item.price)} <button onclick="removeFromCart(${idx})" style="margin-left:8px" class="btn ghost">x</button></span>
    `;
    list.appendChild(li);
  });
  document.getElementById("cart-total").innerText = `Total: ₦${formatNumber(total)}`;
}

function removeFromCart(index) {
  if (index < 0 || index >= cart.length) return;
  total -= cart[index].price;
  cart.splice(index, 1);
  updateCartUI();
}

function clearCart() {
  if (!confirm("Clear cart?")) return;
  cart = [];
  total = 0;
  updateCartUI();
}

/* ---------- CHECKOUT (using Paystack) ---------- */
function startCheckout(e) {
  e.preventDefault();
  if (cart.length === 0) return alert("Cart is empty.");

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const address = document.getElementById("address").value.trim();

  if (!name || !email || !phone || !address) return alert("Please fill customer details.");

  // Prepare metadata and reference
  const reference = "ASAP-" + Date.now();
  const amountKobo = total * 100; // Paystack accepts kobo

  // Optional: Save provisional order before payment (helps with reconciliation)
  const provisionalOrder = {
    reference,
    name, email, phone, address,
    items: cart,
    total,
    currency: "NGN",
    status: "pending",
    createdAt: new Date().toISOString()
  };

  // Save provisional order to Firestore if configured
  if (SAVE_ORDERS && window.db) {
    db.collection("orders").doc(reference).set(provisionalOrder)
      .then(()=> console.log("Provisional order saved."))
      .catch(err => console.warn("Order save failed:", err));
  }

  // Paystack popup
  let handler = PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email: email,
    amount: amountKobo,
    currency: "NGN",
    ref: reference,
    metadata: {
      custom_fields: [
        { display_name: "Full Name", variable_name: "name", value: name },
        { display_name: "Phone", variable_name: "phone", value: phone }
      ]
    },
    callback: function(response){
      // Payment succeeded
      alert("Payment successful. Reference: " + response.reference);

      // Mark order as paid in Firestore if used
      if (SAVE_ORDERS && window.db) {
        db.collection("orders").doc(reference).update({
          status: "paid",
          paidAt: new Date().toISOString(),
          paystackRef: response.reference
        }).catch(err => console.warn("Could not update paid status:", err));
      }

      // Clear cart UI
      cart = [];
      total = 0;
      updateCartUI();
      document.getElementById("checkout-form").reset();
    },
    onClose: function(){
      alert("Transaction closed.");
    }
  });

  handler.openIframe();
}

/* ---------- HELPERS ---------- */
function scrollToShop(){ document.getElementById("shop").scrollIntoView({behavior:"smooth"}); }
function formatNumber(n){ return n.toLocaleString(); }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; }); }

/* ---------- START ---------- */
renderProducts();
updateCartUI();