/* eslint-disable */
// @ts-nocheck

export const D = {
  user: { name: "Wagner", role: "Operations builder", org: "Arctica" },
  activity: {
    id: "a1", name: "Invoice validator", skill: "VAL",
    department: "Finance", squad: "Accounts Payable", agents: 24,
    siblings: [
      { id: "a1", name: "Invoice validator", skill: "VAL", status: "partial" },
      { id: "a2", name: "PO matcher", skill: "MAT", status: "configured" },
      { id: "a3", name: "Payment scheduler", skill: "SCH", status: "empty" }
    ]
  },
  tools: [
    { id: "t1", name: "SQL query", type: "Database", desc: "Run parameterized SQL against approved warehouses.", enabled: true },
    { id: "t2", name: "Web fetch", type: "Network", desc: "Fetch a URL and return parsed body. Allow-list controlled.", enabled: false }
  ],
  templates: [
    { id: "tpl1", name: "Generic invoice validator", desc: "Validates header fields, totals, and PO references against a finance system.", category: "Finance", tools: ["SQL query"] },
    { id: "tpl2", name: "KYC document checker", desc: "Verifies identity documents against issuer registries and detects tampering.", category: "Risk", tools: ["Web fetch"] },
    { id: "tpl3", name: "Ticket triage", desc: "Classifies tier-1 support tickets by intent and urgency.", category: "Support", tools: [] },
    { id: "tpl4", name: "PO matcher", desc: "Three-way match of PO, receipt, and invoice with tolerance bands.", category: "Finance", tools: ["SQL query"] },
    { id: "tpl5", name: "Anomaly flagger", desc: "Surfaces transactions outside historical norms using simple z-score logic.", category: "Risk", tools: ["SQL query"] },
    { id: "tpl6", name: "Email auto-responder", desc: "Generates first-touch responses based on a knowledge base.", category: "Support", tools: ["Web fetch"] }
  ]
};

export const initialState = {
  role: "You are an Invoice validator agent for the Accounts Payable squad. You validate inbound invoices for completeness, integrity, and policy compliance before passing them to PO matching.",
  goal: "For every invoice, verify that all mandatory fields are present, totals match line items, and the supplier is on the approved vendor list. Output a structured validation result.",
  constraints: "Never auto-approve invoices above $10,000.\nNever modify invoice content — only validate.\nIf any required field is missing, return needs_review with a clear reason.",
  outputSchema: `{
  "invoice_id": "string",
  "valid": "boolean",
  "issues": ["string"],
  "next_step": "approve | needs_review | reject"
}`,
  examples: [
    { id: "ex1", input: "INV-2049, supplier ACME Corp, total $4,820, 3 line items matching PO-7711", output: "{ valid: true, issues: [], next_step: \"approve\" }" }
  ],
  knowledge: [
    { id: "k1", name: "AP Policy v3.2.pdf", size: "412 KB", tokens: "8.2K" },
    { id: "k2", name: "Approved supplier list.csv", size: "84 KB", tokens: "2.1K" }
  ],
  guardrails: [
    { id: "g1", text: "If invoice amount > $10,000 → require human approval before downstream routing." },
    { id: "g2", text: "If supplier is not in the approved vendor list → block and notify Procurement." }
  ],
  trigger: "queue",
  benchInput: `{
  "invoice_id": "INV-3122",
  "supplier": "Acme Corp",
  "total": 4820.00,
  "line_items": 3,
  "po_reference": "PO-7711"
}`,
  history: [
    { id: "h1", time: "2m ago", ok: true, summary: "INV-3122 → approve" },
    { id: "h2", time: "8m ago", ok: true, summary: "INV-3120 → needs_review" },
    { id: "h3", time: "21m ago", ok: false, summary: "Schema error" }
  ]
};
