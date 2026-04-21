"use client";

import { useParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { useInvoice } from "@/lib/api-hooks";

export default function InvoiceRenderPage() {
  const params = useParams<{ invoiceId: string }>();
  const invoiceId = Number(params.invoiceId);
  const invoice = useInvoice(Number.isFinite(invoiceId) ? invoiceId : null);

  if (invoice.isLoading) {
    return (
      <main className="min-h-screen bg-white px-8 py-10 text-slate-900">
        <div className="mx-auto max-w-4xl text-sm text-slate-500">Loading invoice…</div>
      </main>
    );
  }

  if (invoice.error || !invoice.data) {
    return (
      <main className="min-h-screen bg-slate-50 px-8 py-10 text-slate-900">
        <div className="mx-auto flex max-w-3xl items-start gap-3 rounded-2xl border border-red-200 bg-white px-5 py-5 shadow-sm">
          <AlertCircle className="mt-0.5 h-5 w-5 text-red-500" />
          <div>
            <div className="font-semibold text-slate-900">Unable to load invoice</div>
            <div className="mt-1 text-sm text-slate-600">
              {invoice.error instanceof Error ? invoice.error.message : "The requested invoice could not be loaded."}
            </div>
          </div>
        </div>
      </main>
    );
  }

  const data = invoice.data;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 print:bg-white print:px-0 print:py-0">
      <article className="mx-auto max-w-4xl rounded-[28px] border border-slate-200 bg-white px-8 py-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)] print:rounded-none print:border-0 print:shadow-none">
        <header className="flex flex-col gap-6 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Invoice</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{data.invoice_number}</h1>
            <div className="mt-3 text-sm text-slate-600">
              Issued {data.issue_date} · Period {data.period_start} to {data.period_end}
            </div>
          </div>
          <div className="grid gap-3 text-sm text-slate-600 sm:text-right">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Status</div>
              <div className="mt-1 font-semibold capitalize text-slate-900">{data.status}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Total</div>
              <div className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                {data.total_amount} {data.currency}
              </div>
            </div>
          </div>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Client</div>
            <div className="mt-2 text-base font-semibold text-slate-950">Client-scoped access</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Invoice date</div>
            <div className="mt-2 text-base font-semibold text-slate-950">{data.issue_date}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Currency</div>
            <div className="mt-2 text-base font-semibold text-slate-950">{data.currency}</div>
          </div>
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full border-collapse">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Hours</th>
                <th className="px-4 py-3 font-medium">Rate</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((line) => (
                <tr key={line.id} className="border-t border-slate-200 text-sm text-slate-700">
                  <td className="px-4 py-4 font-medium text-slate-900">{line.description}</td>
                  <td className="px-4 py-4 capitalize">{line.line_type}</td>
                  <td className="px-4 py-4">{line.hours ?? "—"}</td>
                  <td className="px-4 py-4">{line.unit_price ?? "—"}</td>
                  <td className="px-4 py-4 text-right font-semibold text-slate-950">{line.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {data.notes ? (
          <section className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Notes</div>
            <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{data.notes}</div>
          </section>
        ) : null}
      </article>
    </main>
  );
}
