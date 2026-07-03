// Finite filter vocabularies. Pure module — controls, not parsers, back these
// (langsikt: for a small closed set, a picker beats free-text guessing).

export interface WorktimeExtent {
  id: string // JobTech worktime-extent concept id
  label: string
}

// The two clean worktime extents from the JobTech taxonomy. Timanställd has no
// worktime-extent equivalent, so it is not a search filter — it is still
// captured exactly from the ad at apply time.
export const WORKTIME_EXTENTS: WorktimeExtent[] = [
  { id: '6YE1_gAC_R2G', label: 'Heltid' },
  { id: '947z_JGS_Uk2', label: 'Deltid' },
]
