const express = require("express");
const fetch = require("node-fetch");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.get("/", async (req, res) => {
  const { data } = await supabase
    .from("products")
    .select("*")
    .order("id", { ascending: false });

  let html = `
  <html>
  <head>
    <title>GoDropship Dashboard</title>
    <style>
      body {
        font-family: Arial;
        padding: 20px;
      }

      table {
        border-collapse: collapse;
        width: 100%;
      }

      td, th {
        border: 1px solid #ccc;
        padding: 8px;
      }

      .changed {
        background: #ffe0e0;
      }

      button {
        padding: 10px 20px;
        margin-bottom: 20px;
      }
    </style>
  </head>
  <body>

  <h1>🚀 GoDropship Dashboard</h1>

  <form method="POST" action="/check-products">
    <button type="submit">🔍 Check Products</button>
  </form>

  <table>
    <tr>
      <th>ID</th>
      <th>SKU</th>
      <th>Title</th>
      <th>Old Price</th>
      <th>New Price</th>
      <th>Old Stock</th>
      <th>New Stock</th>
      <th>Status</th>
    </tr>
  `;

  data.forEach(p => {
    const changed = p.price_changed || p.stock_changed;

    html += `
      <tr class="${changed ? "changed" : ""}">
        <td>${p.id}</td>
        <td>${p.sku || ""}</td>
        <td>${p.title || ""}</td>
        <td>${p.old_price || 0}</td>
        <td>${p.new_price || 0}</td>
        <td>${p.old_stock || 0}</td>
        <td>${p.new_stock || 0}</td>
        <td>${p.status || ""}</td>
      </tr>
    `;
  });

  html += `
  </table>
  </body>
  </html>
  `;

  res.send(html);
});

app.post("/check-products", async (req, res) => {
  const { data: products } = await supabase
    .from("products")
    .select("*");

  for (const product of products) {
    try {
      const r = await fetch(product.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        }
      });

      const html = await r.text();

      const priceMatch = html.match(/id="change_child_price"[^>]*>\s*£([\d.]+)/i);

      const stockMatch = html.match(/id="change_child_inventory"[^>]*>\s*(\d+)/i);

      const newPrice = priceMatch ? Number(priceMatch[1]) : 0;
      const newStock = stockMatch ? Number(stockMatch[1]) : 0;

      await supabase
        .from("products")
        .update({
          new_price: newPrice,
          new_stock: newStock,
          price_changed: product.old_price != newPrice,
          stock_changed: product.old_stock != newStock,
          status: "OK",
          last_checked: new Date()
        })
        .eq("id", product.id);

    } catch (e) {
      await supabase
        .from("products")
        .update({
          status: "ERROR"
        })
        .eq("id", product.id);
    }
  }

  res.redirect("/");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running");
});
