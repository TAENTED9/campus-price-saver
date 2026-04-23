"use client";

import { useState } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { usePolling } from "@/hooks/usePolling";
import { adminApi, type AdminVerification } from "@/lib/api";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Badge from "@/components/ui/badge/Badge";
import { CheckCircle, XCircle, Clock, UserCheck } from "lucide-react";

export default function PendingQueuePage() {
  const { token } = useAdminAuth();
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const { data, loading, error, refetch } = usePolling(
    () => adminApi.getVerifications(token!, "Pending"),
    30000,
    !!token
  );

  const verifications: AdminVerification[] = data?.data ?? [];

  const handleApprove = async (id: number, sellerName: string) => {
    if (!window.confirm(`Approve verification for "${sellerName}"?`)) return;
    setActionLoading(id);
    try {
      await adminApi.approveVerification(token!, id);
      await refetch();
    } catch {
      alert("Failed to approve verification. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: number, sellerName: string) => {
    if (!window.confirm(`Reject verification for "${sellerName}"?`)) return;
    setActionLoading(id);
    try {
      await adminApi.rejectVerification(token!, id);
      await refetch();
    } catch {
      alert("Failed to reject verification. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  // Loading skeleton
  if (loading) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Pending Verification Queue" />
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5 md:p-6">
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="h-9 w-9 rounded-full bg-gray-200 dark:bg-gray-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-3 w-1/2 rounded bg-gray-100 dark:bg-gray-800" />
                </div>
                <div className="h-8 w-20 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-8 w-20 rounded bg-gray-200 dark:bg-gray-700" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Pending Verification Queue" />
        <div className="rounded-2xl border border-error-200 bg-error-50 p-5 md:p-6 dark:border-error-500/20 dark:bg-error-500/10">
          <p className="text-sm font-medium text-error-700 dark:text-error-400">
            Failed to load pending verifications: {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageBreadCrumb pageTitle="Pending Verification Queue" />

      <div className="mb-6 rounded-2xl border border-warning-200 bg-warning-50 p-4 dark:border-warning-500/20 dark:bg-warning-500/10">
        <p className="text-sm font-medium text-warning-700 dark:text-warning-400 flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0" />
          Each seller must submit their UNILAG student ID photo. Review submissions and approve or reject within 24-48 hrs.
        </p>
      </div>

      {verifications.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5 md:p-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <UserCheck className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-1">
              No pending verifications
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              All verification requests have been reviewed. Check back later.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                Pending Queue
              </h2>
              <p className="mt-0.5 text-theme-sm text-gray-500 dark:text-gray-400">
                {verifications.length} application{verifications.length !== 1 ? "s" : ""} awaiting review
              </p>
            </div>
            <Badge color="warning">{verifications.length} pending</Badge>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="border-y border-gray-100 dark:border-gray-800">
                <TableRow>
                  <TableCell isHeader className="py-3 text-theme-xs font-medium text-gray-500 dark:text-gray-400">Seller</TableCell>
                  <TableCell isHeader className="py-3 text-theme-xs font-medium text-gray-500 dark:text-gray-400">Matric No.</TableCell>
                  <TableCell isHeader className="py-3 text-theme-xs font-medium text-gray-500 dark:text-gray-400">Faculty</TableCell>
                  <TableCell isHeader className="py-3 text-theme-xs font-medium text-gray-500 dark:text-gray-400">Business Name</TableCell>
                  <TableCell isHeader className="py-3 text-theme-xs font-medium text-gray-500 dark:text-gray-400">Email</TableCell>
                  <TableCell isHeader className="py-3 text-theme-xs font-medium text-gray-500 dark:text-gray-400">Submitted</TableCell>
                  <TableCell isHeader className="py-3 text-theme-xs font-medium text-gray-500 dark:text-gray-400">Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                {verifications.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-600 dark:bg-brand-500/20 dark:text-brand-400">
                          {(v.seller_name || "?").charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-800 text-theme-sm dark:text-white/90">
                          {v.seller_name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 font-mono text-theme-sm text-gray-500 dark:text-gray-400">
                      {v.matric_no}
                    </TableCell>
                    <TableCell className="py-3 text-theme-sm text-gray-500 dark:text-gray-400">
                      {v.faculty}
                    </TableCell>
                    <TableCell className="py-3 text-theme-sm text-gray-500 dark:text-gray-400">
                      {v.business_name}
                    </TableCell>
                    <TableCell className="py-3 text-theme-sm text-gray-500 dark:text-gray-400">
                      {v.email}
                    </TableCell>
                    <TableCell className="py-3 text-theme-sm text-gray-500 dark:text-gray-400">
                      {new Date(v.submitted_at).toLocaleDateString("en-NG", { timeZone: "Africa/Lagos" })}
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={actionLoading === v.id}
                          onClick={() => handleApprove(v.id, v.seller_name)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-success-50 border border-success-200 px-3 py-1.5 text-theme-xs font-medium text-success-700 hover:bg-success-100 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-400 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading === v.id}
                          onClick={() => handleReject(v.id, v.seller_name)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-error-50 border border-error-200 px-3 py-1.5 text-theme-xs font-medium text-error-700 hover:bg-error-100 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
