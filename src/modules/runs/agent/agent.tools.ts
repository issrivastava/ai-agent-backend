/** Runs after a human approves a risky step. Stubs for now: nothing leaves the system. */
export function executeApprovedTool(tool: string | undefined) {
  switch (tool) {
    case 'refund_api':
      return '[Simulated] Refund recorded after approval. No money was moved.';
    case 'email_sender':
      return '[Simulated] Email queued after approval. Nothing was actually sent.';
    default:
      return `[Simulated] ${tool ?? 'Action'} executed after approval.`;
  }
}