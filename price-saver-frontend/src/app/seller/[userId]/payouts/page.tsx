"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import sellerApi from "@/lib/sellerApi";

/**
 * Seller Payouts Page
 * Payout history, pending balances, and payout requests
 */

interface Payout {
  id: string;
  amount: number;
  status: "pending" | "processing" | "completed" | "failed";
  method: "bank" | "paypal";
  requestedAt: string;
  processedAt?: string;
  bankAccount?: string;
  paypalEmail?: string;
  failureReason?: string;
}

interface PayoutBalance {
  available: number;
  pending: number;
  totalEarned: number;
}

export default function PayoutsPage({
  params,
}: {
  params: { userId: string };
}) {
  const { user } = useAuth();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [balance, setBalance] = useState<PayoutBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // In real implementation, would fetch from:
        // const payoutData = await sellerApi.getPayouts(params.userId);
        // const balanceData = await sellerApi.getBalance(params.userId);
        
        // Mock data for now
        setPayouts([
          {
            id: "p1",
            amount: 500,
            status: "completed",
            method: "bank",
            requestedAt: "2024-01-15",
            processedAt: "2024-01-17",
            bankAccount: "**** **** **** 1234",
          },
        ]);
        setBalance({
          available: 1250.5,
          pending: 750.0,
          totalEarned: 5000.0,
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load payouts"
        );
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchData();
    }
  }, [user, params.userId]);

  if (loading) {
    return <div className="text-center py-10">Loading payouts...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
        {error}
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Payouts</h1>
        <button
          onClick={() => setShowRequestForm(!showRequestForm)}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          {showRequestForm ? "Cancel" : "Request Payout"}
        </button>
      </div>

      {/* Balance Overview */}
      {balance && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <BalanceCard
            title="Available Balance"
            amount={balance.available}
            color="bg-green-50 border-green-200"
            icon="💚"
          />
          <BalanceCard
            title="Pending Balance"
            amount={balance.pending}
            color="bg-yellow-50 border-yellow-200"
            icon="⏳"
          />
          <BalanceCard
            title="Total Earned"
            amount={balance.totalEarned}
            color="bg-blue-50 border-blue-200"
            icon="📈"
          />
        </div>
      )}

      {/* Request Payout Form */}
      {showRequestForm && (
        <PayoutRequestForm
          availableBalance={balance?.available || 0}
          sellerId={params.userId}
          onSuccess={() => {
            setShowRequestForm(false);
            // Refresh payouts
          }}
        />
      )}

      {/* Payout History */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold">Payout History</h2>
        </div>

        {payouts.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            <p>No payouts yet</p>
            <p className="text-sm">Request a payout when you have earnings</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {payouts.map((payout) => (
              <PayoutRow key={payout.id} payout={payout} />
            ))}
          </div>
        )}
      </div>

      {/* Payout Methods */}
      <div className="mt -8 bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold mb -4">Payout Methods</h2>
        <p className="text-gray-600 mb-4">
          Add payment methods to receive payouts
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PayoutMethodCard
            method="bank"
            title="Bank Account"
            description="Direct deposit to bank account"
            icon="🏦"
          />
          <PayoutMethodCard
            method="paypal"
            title="PayPal"
            description="Transfer to PayPal account"
            icon="🅿️"
          />
        </div>
      </div>

      {/* FAQ Section */}
      <div className="mt-8 bg-gray-50 rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold mb-4">FAQ</h2>
        <div className="space-y-4">
          <div>
            <p className="font-semibold text-gray-900">
              When will I receive my payout?
            </p>
            <p className="text-gray-600 text-sm mt-1">
              Payouts typically process within 3-5 business days after
              approval.
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-900">
              What's the minimum payout amount?
            </p>
            <p className="text-gray-600 text-sm mt-1">
              Minimum payout is $50. There's no maximum limit.
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-900">
              Are there any fees?
            </p>
            <p className="text-gray-600 text-sm mt-1">
              Bank transfers are free. PayPal transfers have a small fee (2%).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BalanceCard({
  title,
  amount,
  color,
  icon,
}: {
  title: string;
  amount: number;
  color: string;
  icon: string;
}) {
  return (
    <div className={`rounded-lg border p-6 ${color}`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-gray-700 text-sm mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">
            ${amount.toFixed(2)}
          </p>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
}

function PayoutRow({ payout }: { payout: Payout }) {
  const getStatusColor = (status: Payout["status"]) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700";
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      case "processing":
        return "bg-blue-100 text-blue-700";
      case "failed":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="px-6 py-4 hover:bg-gray-50 transition-colors">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="font-semibold text-gray-900">
            ${payout.amount.toFixed(2)}
          </p>
          <p className="text-sm text-gray-600">
            {payout.method === "bank" ? "🏦 Bank" : "🅿️ PayPal"} •{" "}
            {new Date(payout.requestedAt).toLocaleDateString()}
          </p>
          {payout.failureReason && (
            <p className="text-sm text-red-600 mt-1">{payout.failureReason}</p>
          )}
        </div>
        <span
          className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(
            payout.status
          )}`}
        >
          {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
        </span>
      </div>
    </div>
  );
}

function PayoutMethodCard({
  method,
  title,
  description,
  icon,
}: {
  method: "bank" | "paypal";
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="border border-gray-300 rounded-lg p-4 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer">
      <div className="flex justify-between items-start mb-2">
        <span className="text-3xl">{icon}</span>
        <input type="radio" name="payout_method" value={method} />
      </div>
      <p className="font-semibold text-gray-900">{title}</p>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}

function PayoutRequestForm({
  availableBalance,
  sellerId,
  onSuccess,
}: {
  availableBalance: number;
  sellerId: string;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"bank" | "paypal">("bank");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      const requestAmount = parseFloat(amount);
      if (requestAmount < 50) {
        setError("Minimum payout is $50");
        return;
      }
      if (requestAmount > availableBalance) {
        setError("Amount exceeds available balance");
        return;
      }

      // In real implementation:
      // await sellerApi.requestPayout(sellerId, {
      //   amount: requestAmount,
      //   method: method,
      // });

      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to request payout"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
      <h3 className="text-lg font-bold mb-4">Request Payout</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-2">
            Amount (Available: ${availableBalance.toFixed(2)})
          </label>
          <input
            type="number"
            step="0.01"
            min="50"
            max={availableBalance}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0.00"
          />
          <p className="text-xs text-gray-500 mt-1">Minimum: $50.00</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Payout Method
          </label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="radio"
                name="method"
                value="bank"
                checked={method === "bank"}
                onChange={() => setMethod("bank")}
                className="mr-2"
              />
              <span className="text-gray-700">Bank Account</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="method"
                value="paypal"
                checked={method === "paypal"}
                onChange={() => setMethod("paypal")}
                className="mr-2"
              />
              <span className="text-gray-700">PayPal</span>
            </label>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading || !amount}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
          >
            {loading ? "Processing..." : "Request Payout"}
          </button>
        </div>
      </form>
    </div>
  );
}
