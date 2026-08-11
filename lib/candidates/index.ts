// Public entry point for the candidates module.
//
//   URL -> detectPlatform() -> platform adapter -> Candidate -> session
//
// Everything Session/Vote UI needs is re-exported here; UI code should not
// reach into platforms/adapters/* directly.

export * from "./types";
export * from "./createCandidate";
export * from "./id";
export * from "./seedCandidates";
export * from "./createCandidateFromUrl";

export * from "./platforms/types";
export * from "./platforms/detectPlatform";
export * from "./platforms/registry";

export * from "./session/types";
export * from "./session/addCandidateToSession";
export * from "./session/updateCandidateTitle";
export * from "./session/removeCandidateFromSession";
