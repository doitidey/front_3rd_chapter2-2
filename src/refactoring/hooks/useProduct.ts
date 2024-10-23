import { useState } from "react";
import { Product } from "../../types.ts";

export const useProducts = (initialProducts: Product[]) => {
  const [products, setProducts] = useState<Product[]>(initialProducts);

  const updateProduct = (updatedProduct: Product) => {
    setProducts((prevProducts) => replaceProduct(prevProducts, updatedProduct));
  };

  function replaceProduct(
    products: Product[],
    updatedProduct: Product
  ): Product[] {
    return products.map((product) =>
      product.id === updatedProduct.id ? updatedProduct : product
    );
  }

  const addProduct = (newProduct: Product) => {
    setProducts([...products, newProduct]);
  };

  return { products, updateProduct, addProduct };
};
