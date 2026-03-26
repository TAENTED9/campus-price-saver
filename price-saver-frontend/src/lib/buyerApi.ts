import apiClient from "./api";

/**
 * Buyer API Client
 * Methods for buyer dashboard, wishlist, orders, and recommendations
 */

export const buyerApi = {
  /**
   * Get recommended products for buyer
   */
  async getRecommended(buyerId: string, limit: number = 12) {
    const response = await apiClient.get(
      `/buyer/${buyerId}/recommended?limit=${limit}`
    );
    return response.data;
  },

  /**
   * Get buyer's order history
   */
  async getOrders(buyerId: string, page: number = 1, limit: number = 10) {
    const response = await apiClient.get(
      `/buyer/${buyerId}/orders?page=${page}&limit=${limit}`
    );
    return response.data;
  },

  /**
   * Get order details
   */
  async getOrder(buyerId: string, orderId: string) {
    const response = await apiClient.get(
      `/buyer/${buyerId}/orders/${orderId}`
    );
    return response.data;
  },

  /**
   * Get buyer's wishlist
   */
  async getWishlist(buyerId: string, page: number = 1, limit: number = 20) {
    const response = await apiClient.get(
      `/buyer/${buyerId}/wishlist?page=${page}&limit=${limit}`
    );
    return response.data;
  },

  /**
   * Add item to wishlist
   */
  async addToWishlist(buyerId: string, itemId: string) {
    const response = await apiClient.post(
      `/buyer/${buyerId}/wishlist`,
      { item_id: itemId }
    );
    return response.data;
  },

  /**
   * Remove item from wishlist
   */
  async removeFromWishlist(buyerId: string, itemId: string) {
    const response = await apiClient.delete(
      `/buyer/${buyerId}/wishlist/${itemId}`
    );
    return response.data;
  },

  /**
   * Search products
   */
  async searchProducts(query: string, filters?: {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    seller?: string;
  }) {
    const params = new URLSearchParams({ q: query });
    if (filters?.category) params.append("category", filters.category);
    if (filters?.minPrice) params.append("min_price", filters.minPrice.toString());
    if (filters?.maxPrice) params.append("max_price", filters.maxPrice.toString());
    if (filters?.seller) params.append("seller", filters.seller);

    const response = await apiClient.get(`/search?${params.toString()}`);
    return response.data;
  },

  /**
   * Get product details
   */
  async getProduct(productId: string) {
    const response = await apiClient.get(`/items/${productId}`);
    return response.data;
  },

  /**
   * Get saved sellers (favorite sellers)
   */
  async getSavedSellers(buyerId: string) {
    const response = await apiClient.get(`/buyer/${buyerId}/saved-sellers`);
    return response.data;
  },

  /**
   * Save a seller
   */
  async saveSeller(buyerId: string, sellerId: string) {
    const response = await apiClient.post(
      `/buyer/${buyerId}/saved-sellers`,
      { seller_id: sellerId }
    );
    return response.data;
  },

  /**
   * Get buyer profile
   */
  async getProfile(buyerId: string) {
    const response = await apiClient.get(`/buyer/${buyerId}/profile`);
    return response.data;
  },

  /**
   * Update buyer profile
   */
  async updateProfile(
    buyerId: string,
    data: {
      fullName?: string;
      email?: string;
      phone?: string;
      address?: string;
    }
  ) {
    const response = await apiClient.put(
      `/buyer/${buyerId}/profile`,
      data
    );
    return response.data;
  },

  /**
   * Get saved locations
   */
  async getLocations(buyerId: string) {
    const response = await apiClient.get(`/buyer/${buyerId}/locations`);
    return response.data;
  },

  /**
   * Add saved location
   */
  async addLocation(
    buyerId: string,
    data: {
      label: string;
      address: string;
      latitude: number;
      longitude: number;
    }
  ) {
    const response = await apiClient.post(
      `/buyer/${buyerId}/locations`,
      data
    );
    return response.data;
  },
};

export default buyerApi;
