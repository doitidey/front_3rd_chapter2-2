import { createContext, type Key, memo, useContext, useState } from "react"
import type { Cart, CartItem, Coupon, Discount, Product } from "../../types.ts"

// entities/Product
const getMaxDiscountRate = (discounts: Discount[]) => {
  return discounts.reduce((max, discount) => Math.max(max, discount.rate), -Infinity)
}

// ???
const getMaxDiscount = (discounts: Discount[], quantity: number) => {
  return discounts.reduce((maxDiscount, d) => {
    return quantity >= d.quantity && d.rate > maxDiscount ? d.rate : maxDiscount
  }, 0)
}

// entities/CartItem
const getAppliedDiscount = (item: CartItem) => {
  const { discounts } = item.product
  const { quantity } = item

  let appliedDiscount = 0
  for (const discount of discounts) {
    if (quantity >= discount.quantity) {
      appliedDiscount = Math.max(appliedDiscount, discount.rate)
    }
  }

  return appliedDiscount
}

//--- features

// features/Product
const getRemainingStock = (product: Product, cart: Cart) => {
  const cartItem = cart.find((item) => item.product.id === product.id)
  return product.stock - (cartItem?.quantity || 0)
}

// features/Cart
const addCartItem = (cart: Cart, product: Product) => [...cart, { product, quantity: 1 }]

const hasCartItem = (cart: Cart, product: Product) => cart.find((item) => item.product.id === product.id)

const updateCartItemQuantity = (cart: Cart, productId: Product["id"], quantityFn: Function) => {
  return cart
    .map((item) =>
      item.product.id === productId
        ? { ...item, quantity: Math.max(0, Math.min(quantityFn(item), item.product.stock)) }
        : item,
    )
    .filter(Boolean)
}

const removeCartItem = (cart: Cart, productId: Product["id"]) => cart.filter((item) => item.product.id !== productId)

// shared/lib/array
const total = (cart, fn) => cart.reduce((sum, item) => sum + fn(item), 0)

// features/Cart
const calculateTotalBeforeDiscount = (cart: Cart) => total(cart, (item) => item.product.price * item.quantity)

// features/Cart
const calculateTotal = (cart: Cart, selectedCoupon: Coupon | null) => {
  const totalBeforeDiscount = calculateTotalBeforeDiscount(cart)

  const totalAfterDiscount = (() => {
    let totalAfterDiscount = total(cart, (item) => {
      const discount = getMaxDiscount(item.product.discounts, item.quantity)
      return item.product.price * item.quantity * (1 - discount)
    })

    // 쿠폰 적용
    if (selectedCoupon) {
      if (selectedCoupon.discountType === "amount") {
        totalAfterDiscount = Math.max(0, totalAfterDiscount - selectedCoupon.discountValue)
      } else {
        totalAfterDiscount *= 1 - selectedCoupon.discountValue / 100
      }
    }

    return totalAfterDiscount
  })()

  const totalDiscount = totalBeforeDiscount - totalAfterDiscount

  return {
    totalBeforeDiscount: Math.round(totalBeforeDiscount),
    totalAfterDiscount: Math.round(totalAfterDiscount),
    totalDiscount: Math.round(totalDiscount),
  }
}

// shared/utils
export const createContextHook = <T extends any>(useCartState: () => T) => {
  const CartContext = createContext({} as T)

  function CartProvider({ children }) {
    return <CartContext.Provider value={useCartState()}>{children}</CartContext.Provider>
  }

  function useCart() {
    const context = useContext(CartContext)
    if (!context) {
      throw new Error("useCart must be used within CartProvider")
    }
    return context as ReturnType<typeof useCartState>
  }

  return [CartProvider, useCart] as const
}

// features/Cart/hooks
export const [CartProvider, useCart] = createContextHook(() => {
  const [cart, setCart] = useState<CartItem[]>([])

  function addToCart(product: Product) {
    const remainingStock = getRemainingStock(product, cart)
    if (remainingStock <= 0) return

    setCart((cart) => {
      return hasCartItem(cart, product)
        ? updateCartItemQuantity(cart, product.id, (item) => item.quantity + 1)
        : addCartItem(cart, product)
    })
  }

  function removeFromCart(productId: string) {
    setCart((prevCart) => removeCartItem(prevCart, productId))
  }

  function updateQuantity(productId: string, newQuantity: number) {
    setCart((prevCart) => updateCartItemQuantity(prevCart, productId, () => newQuantity))
  }

  return {
    cart,
    setCart,
    addToCart,
    removeFromCart,
    updateQuantity,
  }
})

// features/Coupon/hooks
export const [CouponProvider, useCoupon] = createContextHook(() => {
  const initialCoupons: Coupon[] = [
    {
      name: "5000원 할인 쿠폰",
      code: "AMOUNT5000",
      discountType: "amount",
      discountValue: 5000,
    },
    {
      name: "10% 할인 쿠폰",
      code: "PERCENT10",
      discountType: "percentage",
      discountValue: 10,
    },
  ]

  const [coupons, setCoupons] = useState<Coupon[]>(initialCoupons)
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null)

  const [newCoupon, setNewCoupon] = useState<Coupon>({
    name: "",
    code: "",
    discountType: "percentage",
    discountValue: 0,
  })

  return {
    coupons,
    setCoupons,

    selectedCoupon,
    setSelectedCoupon,

    newCoupon,
    setNewCoupon,
  }
})

// features/Coupon/hooks
export const [ProductProvider, useProduct] = createContextHook(() => {
  const initialProducts: Product[] = [
    {
      id: "p1",
      name: "상품1",
      price: 10000,
      stock: 20,
      discounts: [
        { quantity: 10, rate: 0.1 },
        { quantity: 20, rate: 0.2 },
      ],
    },
    {
      id: "p2",
      name: "상품2",
      price: 20000,
      stock: 20,
      discounts: [{ quantity: 10, rate: 0.15 }],
    },
    {
      id: "p3",
      name: "상품3",
      price: 30000,
      stock: 20,
      discounts: [{ quantity: 10, rate: 0.2 }],
    },
  ]

  const [products, setProducts] = useState<Product[]>(initialProducts)

  return {
    products,
    setProducts,
  }
})

// widgets/product/ui
const ProductView = ({ key, product }: { key: Key; product: Product }) => {
  const { cart, addToCart } = useCart()
  const remainingStock = getRemainingStock(product, cart)

  return (
    <div data-testid={`product-${product.id}`} className="bg-white p-3 rounded shadow">
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold">{product.name}</span>
        <span className="text-gray-600">{product.price.toLocaleString()}원</span>
      </div>

      <div className="text-sm text-gray-500 mb-2">
        <span className={`font-medium ${remainingStock > 0 ? "text-green-600" : "text-red-600"}`}>
          재고: {remainingStock}개
        </span>
        {product.discounts.length > 0 && (
          <span className="ml-2 font-medium text-blue-600">
            최대 {(getMaxDiscountRate(product.discounts) * 100).toFixed(0)}% 할인
          </span>
        )}
      </div>

      {product.discounts.length > 0 && (
        <ul className="list-disc list-inside text-sm text-gray-500 mb-2">
          {product.discounts.map((discount, index) => (
            <li key={index}>
              {discount.quantity}개 이상: {(discount.rate * 100).toFixed(0)}% 할인
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={() => addToCart(product)}
        className={`w-full px-3 py-1 rounded ${
          remainingStock > 0
            ? "bg-blue-500 text-white hover:bg-blue-600"
            : "bg-gray-300 text-gray-500 cursor-not-allowed"
        }`}
        disabled={remainingStock <= 0}
      >
        {remainingStock > 0 ? "장바구니에 추가" : "품절"}
      </button>
    </div>
  )
}

// shared/ui
const ActionButton = ({ children, onClick }) => (
  <button className="bg-gray-300 text-gray-800 px-2 py-1 rounded mr-1 hover:bg-gray-400" onClick={onClick}>
    {children}
  </button>
)

// shared/ui
const DangerButton = ({ children, onClick }) => (
  <button className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600" onClick={onClick}>
    삭제
  </button>
)

// shared/ui
const Title2 = ({ children }) => <h2 className="text-2xl font-semibold mb-2">{children}</h2>

const CartSummaryView = memo(() => {
  const { cart } = useCart()
  const { selectedCoupon } = useCoupon()
  const { totalBeforeDiscount, totalAfterDiscount, totalDiscount } = calculateTotal(cart, selectedCoupon)

  return (
    <div className="bg-white p-4 rounded shadow">
      <Title2>주문 요약</Title2>

      <div className="space-y-1">
        <p>상품 금액: {totalBeforeDiscount.toLocaleString()}원</p>
        <p className="text-green-600">할인 금액: {totalDiscount.toLocaleString()}원</p>
        <p className="text-xl font-bold">최종 결제 금액: {totalAfterDiscount.toLocaleString()}원</p>
      </div>
    </div>
  )
})

const CartProductListView = () => {
  const { products } = useProduct()

  return (
    <div>
      <Title2>상품 목록</Title2>

      <div className="mt-4 space-y-2">
        {products.map((product, index) => (
          <ProductView key={index} product={product} />
        ))}
      </div>
    </div>
  )
}

// features/쿠폰적용
const CouponSelector = () => {
  const { coupons, selectedCoupon, setSelectedCoupon } = useCoupon()

  function handleApplyCoupon(coupon: Coupon | null) {
    setSelectedCoupon(coupon)
  }

  return (
    <div className="bg-white p-4 rounded shadow">
      <Title2>쿠폰 적용</Title2>

      <select
        className="w-full p-2 border rounded mb-2"
        onChange={(e) => handleApplyCoupon(coupons[parseInt(e.target.value)])}
      >
        <option value="">쿠폰 선택</option>
        {coupons.map((coupon, index) => (
          <option key={coupon.code} value={index}>
            {coupon.name} -{" "}
            {coupon.discountType === "amount" ? `${coupon.discountValue}원` : `${coupon.discountValue}%`}
          </option>
        ))}
      </select>

      {selectedCoupon && (
        <p className="text-green-600">
          적용된 쿠폰: {selectedCoupon.name}(
          {selectedCoupon.discountType === "amount"
            ? `${selectedCoupon.discountValue}원`
            : `${selectedCoupon.discountValue}%`}{" "}
          할인)
        </p>
      )}
    </div>
  )
}

// features/CartItem/ui
const CartItemView = ({ key, cartItem }: { key: Key; cartItem: CartItem }) => {
  const appliedDiscount = getAppliedDiscount(cartItem)

  // @FIXME
  const { updateQuantity, removeFromCart } = useCart()

  function handleUpdateQuantity(productId: string, newQuantity: number) {
    return updateQuantity(productId, newQuantity)
  }

  function handleRemoveFromCart(productId: string) {
    return removeFromCart(productId)
  }

  return (
    <div className="flex justify-between items-center bg-white p-3 rounded shadow">
      <div>
        <span className="font-semibold">{cartItem.product.name}</span>
        <br />
        <span className="text-sm text-gray-600">
          {cartItem.product.price}원 x {cartItem.quantity}
          {appliedDiscount > 0 && (
            <span className="text-green-600 ml-1">({(appliedDiscount * 100).toFixed(0)}% 할인 적용)</span>
          )}
        </span>
      </div>

      {/* @FIXME */}
      <div>
        <ActionButton onClick={() => handleUpdateQuantity(cartItem.product.id, cartItem.quantity + 1)}>+</ActionButton>
        <ActionButton onClick={() => handleUpdateQuantity(cartItem.product.id, cartItem.quantity - 1)}>-</ActionButton>
        <DangerButton onClick={() => handleRemoveFromCart(cartItem.product.id)}>삭제</DangerButton>
      </div>
    </div>
  )
}

// widgets/장바구니
const CartItemsListView = () => {
  const { cart } = useCart()
  return (
    <div className="space-y-2">
      {cart.map((item, index) => (
        <CartItemView key={item.product.id} cartItem={item} />
      ))}
    </div>
  )
}

// widgets/장바구니 내역
const CartItemsView = () => (
  <div>
    <h2 className="text-2xl font-semibold mb-4">장바구니 내역</h2>

    <div className="space-y-6">
      {/*카트 목록*/}
      <CartItemsListView />

      {/*쿠폰 적용*/}
      <CouponSelector />

      {/*주문 요약*/}
      <CartSummaryView />
    </div>
  </div>
)

export const CartPage = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">장바구니</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/*상품 목록*/}
        <CartProductListView />

        {/*장바구니 내역*/}
        <CartItemsView />
      </div>
    </div>
  )
}
