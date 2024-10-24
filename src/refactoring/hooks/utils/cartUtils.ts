import { CartItem, Coupon } from "../../../types";

export const calculateItemTotal = (item: CartItem) => {
  const discountRate = getMaxApplicableDiscount(item);
  return getPriceBeforeDiscount(item) * (1 - discountRate);
};

const getPriceBeforeDiscount = (item: CartItem) => {
  const { product, quantity } = item;
  return product.price * quantity;
};

export const getMaxApplicableDiscount = (item: CartItem) => {
  const { product, quantity } = item;

  const maxDiscount = product.discounts
    .filter((discount) => quantity >= discount.quantity)
    .reduce((maxRate, discount) => Math.max(maxRate, discount.rate), 0);

  return maxDiscount;
};

export const calculateCartTotal = (
  cart: CartItem[],
  selectedCoupon: Coupon | null
) => {
  const totalBeforeDiscount = cart
    .map((item) => getPriceBeforeDiscount(item))
    .reduce((prev, cur) => {
      return (prev += cur);
    }, 0);

  let totalAfterDiscount = cart
    .map((item) => calculateItemTotal(item))
    .reduce((prev, cur) => {
      return (prev += cur);
    }, 0);

  if (selectedCoupon !== null) {
    if (selectedCoupon.discountType === "amount") {
      totalAfterDiscount = Math.max(
        0,
        totalAfterDiscount - selectedCoupon.discountValue
      );
    } else {
      totalAfterDiscount *= 1 - selectedCoupon.discountValue / 100;
    }
  }

  const totalDiscount = totalBeforeDiscount - totalAfterDiscount;

  return {
    totalBeforeDiscount,
    totalAfterDiscount,
    totalDiscount,
  };
};

const updateProductQuantity = (item: CartItem, newQuantity: number) => {
  const quantityLimit = item.product.stock;
  const quantity = quantityLimit < newQuantity ? quantityLimit : newQuantity;
  return { ...item, quantity: quantity };
};

export const updateCartItemQuantity = (
  cart: CartItem[],
  productId: string,
  newQuantity: number
): CartItem[] => {
  if (newQuantity > 0) {
    const cartItemList = cart.map((item) =>
      item.product.id === productId
        ? updateProductQuantity(item, newQuantity)
        : item
    );
    return cartItemList;
  }
  const cartItemList = cart.filter((item) => item.product.id !== productId);
  return cartItemList;
};
