import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App.tsx"
import { CartProvider, CouponProvider, ProductProvider } from "./components/CartPage.tsx"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ProductProvider>
      <CouponProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </CouponProvider>
    </ProductProvider>
  </React.StrictMode>,
)
