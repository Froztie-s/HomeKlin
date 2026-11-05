import type { AgencyActionState } from "@/lib/agency/actions";

// The shape of the agency's Server Actions (src/lib/agency/actions.ts) as the client forms receive them.
// The server components pass the actions in as props, so the client forms import only types from that
// module (erased at build time) and stay easy to render in isolation.
export type AgencyAction = (previous: AgencyActionState, formData: FormData) => Promise<AgencyActionState>;
