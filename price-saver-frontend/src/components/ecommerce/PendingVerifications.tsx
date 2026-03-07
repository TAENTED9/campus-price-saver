"use client";
import React, { useCallback, useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";
import Badge from "../ui/badge/Badge";
import Link from "next/link";
import { adminApi, type VerificationRequest } from "@/lib/adminApi";

export default function PendingVerifications() {
  const [rows, setRows] = useState<VerificationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);

  const load = useCallback(() => {
    setIsLoading(true);
    adminApi
      .getVerifications()
      .then((res) => { if (res.success) setRows(res.data); })
      .catch(() => {/* keep empty on error */})
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id: number) => {
    setActionId(id);
    try {
      await adminApi.approveVerification(id);
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "Approved" } : r))
      );
    } finally { setActionId(null); }
  };

  const handleReject = async (id: number) => {
    setActionId(id);
    try {
      await adminApi.rejectVerification(id);
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "Rejected" } : r))
      );
    } finally { setActionId(null); }
  };

  const pendingCount = rows.filter((r) => r.status === "Pending").length;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6">
      <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Pending Seller Verifications
          </h3>
          <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
            Review student ID submissions and approve verified sellers.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isLoading && <Badge color="warning">{pendingCount} pending</Badge>}
          <Link
            href="/admin/verification/pending"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200"
          >
            See all
          </Link>
        </div>
      </div>

      <div className="max-w-full overflow-x-auto">
        {isLoading ? (
          <div className="py-10 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
            No pending verifications — great job!
          </p>
        ) : (
          <Table>
            <TableHeader className="border-gray-100 dark:border-gray-800 border-y">
              <TableRow>
                {["Seller", "Matric No.", "Faculty", "Business", "Submitted", "Status", "Actions"].map((h) => (
                  <TableCell key={h} isHeader className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-600 font-semibold text-sm dark:bg-brand-500/20 dark:text-brand-400">
                        {request.sellerName.charAt(0)}
                      </div>
                      <span className="font-medium text-gray-800 text-theme-sm dark:text-white/90">
                        {request.sellerName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 font-mono text-theme-sm text-gray-500 dark:text-gray-400">
                    {request.matricNo}
                  </TableCell>
                  <TableCell className="py-3 text-theme-sm text-gray-500 dark:text-gray-400">
                    {request.faculty}
                  </TableCell>
                  <TableCell className="py-3 text-theme-sm text-gray-500 dark:text-gray-400">
                    {request.businessName}
                  </TableCell>
                  <TableCell className="py-3 text-theme-sm text-gray-500 dark:text-gray-400">
                    {request.submittedAt}
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge size="sm" color={
                      request.status === "Pending" ? "warning"
                      : request.status === "Under Review" ? "info"
                      : request.status === "Approved" ? "success"
                      : "error"
                    }>
                      {request.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/verification/pending/${request.id}`}
                        className="inline-flex items-center rounded-lg border border-brand-300 bg-brand-50 px-3 py-1.5 text-theme-xs font-medium text-brand-600 hover:bg-brand-100 dark:border-brand-700 dark:bg-brand-500/10 dark:text-brand-400"
                      >
                        Review
                      </Link>
                      {(request.status === "Pending" || request.status === "Under Review") && (
                        <>
                          <button
                            type="button"
                            disabled={actionId === request.id}
                            onClick={() => handleApprove(request.id)}
                            className="inline-flex items-center rounded-lg border border-success-300 bg-success-50 px-3 py-1.5 text-theme-xs font-medium text-success-600 hover:bg-success-100 disabled:opacity-50 dark:border-success-700 dark:bg-success-500/10 dark:text-success-400"
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            disabled={actionId === request.id}
                            onClick={() => handleReject(request.id)}
                            className="inline-flex items-center rounded-lg border border-error-300 bg-error-50 px-3 py-1.5 text-theme-xs font-medium text-error-600 hover:bg-error-100 disabled:opacity-50 dark:border-error-700 dark:bg-error-500/10 dark:text-error-400"
                          >
                            ✕
                          </button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
