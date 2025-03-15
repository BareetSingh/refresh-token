import API_Factory from "@/utils/API_Factory";

export const ProductService = {
    addProduct: (data, token) =>
        API_Factory("POST", "/api/products", data, token, true, "multipart/form-data"),

    getProducts: (token) =>
        API_Factory("GET", `/api/products`, null, token, true, "application/json"),

};