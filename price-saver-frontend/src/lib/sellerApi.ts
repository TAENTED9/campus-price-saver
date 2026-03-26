import apiClient from "./api";

/**
 * Seller API Client
 * Methods for seller dashboard, inventory, analytics, and orders
 */

export const sellerApi = {
  /**
   * Get seller statistics (sales, revenue, listings, orders)
   */
  async getStats(sellerId: string) {
    const response = await apiClient.get(`/seller/${sellerId}/stats`);
    return response.data;
  },

  /**
   * Get recent orders for seller
   */
  async getRecentOrders(sellerId: string, limit: number = 10) {
    const response = await apiClient.get(
      `/seller/${sellerId}/orders?limit=${limit}`
    );
    return response.data;
  },

  /**
   * Get seller's inventory
   */
  async getInventory(
    sellerId: string,
    page: number = 1,
    limit: number = 20
  ) {
    const response = await apiClient.get(
      `/seller/${sellerId}/inventory?page=${page}&limit=${limit}`
    );
    return response.data;
  },

  /**
   * Get seller analytics (revenue trends, top products, etc.)
   */
  async getAnalytics(sellerId: string, period: string = "month") {
    const response = await apiClient.get(
      `/seller/${sellerId}/analytics?period=${period}`
    );
    return response.data;
  },

  /**
   * Upload bulk inventory
   */
  async uploadInventory(sellerId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await apiClient.post(
      `/seller/${sellerId}/inventory/bulk`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  },

  /**
   * Create a new product listing
   */
  async createListing(sellerId: string, data: {
    name: string;
    description: string;
    price: number;
    category: string;
    quantity?: number;
    images?: string[];
  }) {
    const response = await apiClient.post(
      `/seller/${sellerId}/inventory`,
      data
    );
    return response.data;
  },

  /**
   * Update product listing
   */
  async updateListing(
    sellerId: string,
    listingId: string,
    data: Partial<{
      name: string;
      description: string;
      price: number;
      quantity: number;
    }>
  ) {
    const response = await apiClient.put(
      `/seller/${sellerId}/inventory/${listingId}`,
      data
    );
    return response.data;
  },

  /**
   * Delete product listing
   */
  async deleteListing(sellerId: string, listingId: string) {
    const response = await apiClient.delete(
      `/seller/${sellerId}/inventory/${listingId}`
    );
    return response.data;
  },

  /**
   * Get payout information
   */
  async getPayouts(sellerId: string, status?: string) {
    let url = `/seller/${sellerId}/payouts`;
    if (status) {
      url += `?status=${status}`;
    }
    const response = await apiClient.get(url);
    return response.data;
  },

  /**
   * Request payout
   */
  async requestPayout(
    sellerId: string,
    data: {
      amount: number;
      method: "bank" | "paypal";
    }
  ) {
    const response = await apiClient.post(
      `/seller/${sellerId}/payouts/request`,
      data
    );
    return response.data;
  },

  /**
   * Get seller ratings and reviews
   */
  async getRatings(sellerId: string) {
    const response = await apiClient.get(`/seller/${sellerId}/ratings`);
    return response.data;
  },

  /**
   * Get seller profile
   */
  async getProfile(sellerId: string) {
    const response = await apiClient.get(`/seller/${sellerId}/profile`);
    return response.data;
  },

  /**
   * Update seller profile
   */
  async updateProfile(
    sellerId: string,
    data: {
      storeName?: string;
      description?: string;
      logo?: string;
      banner?: string;
    }
  ) {
    const response = await apiClient.put(
      `/seller/${sellerId}/profile`,
      data
    );
    return response.data;
  },
};

export default sellerApi;
