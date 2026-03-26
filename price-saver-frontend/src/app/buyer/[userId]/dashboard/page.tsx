"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

/**
 * Buyer Dashboard
 * Personalized shopping experience, recommendations, recent purchases
 */

interface RecommendedProduct {
  id: string;
  name: string;
  price: number;
  image?: string;
  seller: {
    id: string;
    name: string;
  };
  category: string;
}

interface RecentPurchase {
  id: string;
  productName: string;
  seller: string;
  purchaseDate: string;
  total: number;
}

export default function BuyerDashboard({
  params,
}: {
  params: { userId: string };
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [recommended, setRecommended] = useState<RecommendedProduct[]>([]);
  const [purchases, setPurchases] = useState<RecentPurchase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // TODO: Fetch recommended products from API
        // const recommended = await api.getRecommended(params.userId);
        // setRecommended(recommended);

        // TODO: Fetch recent purchases from API
        // const purchases = await api.getRecentPurchases(params.userId);
        // setPurchases(purchases);

        // Mock data for now
        setRecommended([
          {
            id: "1",
            name: "Sample Product",
            price: 29.99,
            seller: { id: "1", name: "Sample Seller" },
            category: "Electronics",
          },
        ]);
      } catch (err) {
        console.error("Failed to load dashboard:", err);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchData();
    }
  }, [user, params.userId]);

  if (loading) {
    return <div className="text-center py-10">Loading dashboard...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Welcome to Price Saver</h1>

      {/* Featured Recommendations */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-4">Recommended for You</h2>
        {recommended.length === 0 ? (
          <div className="bg-gray-100 rounded-lg p-8 text-center">
            <p className="text-gray-600 mb-4">No recommendations yet</p>
            <button
              onClick={() => router.push("/explore")}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Browse Products
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {recommended.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Recent Purchases */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Recent Purchases</h2>
        {purchases.length === 0 ? (
          <div className="bg-gray-100 rounded-lg p-8 text-center">
            <p className="text-gray-600">You haven't made any purchases yet</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left px-6 py-3">Product</th>
                  <th className="text-left px-6 py-3">Seller</th>
                  <th className="text-right px-6 py-3">Amount</th>
                  <th className="text-left px-6 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((purchase) => (
                  <tr key={purchase.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-3">{purchase.productName}</td>
                    <td className="px-6 py-3">{purchase.seller}</td>
                    <td className="px-6 py-3 text-right font-semibold">
                      ${purchase.total.toFixed(2)}
                    </td>
                    <td className="px-6 py-3">
                      {new Date(purchase.purchaseDate).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function ProductCard({ product }: { product: RecommendedProduct }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
      <div className="aspect-square bg-gray-200 flex items-center justify-center">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-gray-400">No image</span>
        )}
      </div>
      <div className="p-4">
        <p className="text-xs text-gray-500 mb-1">{product.category}</p>
        <h3 className="font-semibold text-sm mb-2 line-clamp-2">
          {product.name}
        </h3>
        <p className="text-sm text-gray-600 mb-3">{product.seller.name}</p>
        <p className="text-lg font-bold">${product.price.toFixed(2)}</p>
      </div>
    </div>
  );
}
