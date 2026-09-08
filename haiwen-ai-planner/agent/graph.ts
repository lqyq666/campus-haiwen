import { END, START, StateGraph } from "@langchain/langgraph";
import { getRuntimeSchoolDataRepositories } from "@/lib/repositories/school-data";
import { pathRouter, profileValidation, scoring } from "./nodes/assessment";
import { leadScore } from "./nodes/lead";
import { profileEnrichment } from "./nodes/placeholders";
import { createRagNodes } from "./nodes/rag";
import {
  reportContractGeneration,
  reportValidation,
  roadmapGeneration,
  schoolMatching,
} from "./nodes/recommendation";
import {
  createSchoolDataNodes,
  type SchoolDataNodeDependencies,
} from "./nodes/school-data";
import { HaiwenGraphState } from "./state";

export function createHaiwenGraph(
  dependencies?: SchoolDataNodeDependencies & {
    retrievalRepository?: import("@/domain/retrieval/repository").RetrievalRepository;
  }
) {
  const runtime = () => getRuntimeSchoolDataRepositories();
  const schoolData = createSchoolDataNodes(() => dependencies ?? runtime());
  const rag = createRagNodes({
    getSourceDocument: (id) =>
      (dependencies ?? runtime()).evidenceRepository.getSourceDocument(id),
    retrievalRepository: () =>
      dependencies?.retrievalRepository ?? runtime().retrievalRepository,
  });
  return new StateGraph(HaiwenGraphState)
    .addNode("profile_validation", profileValidation)
    .addNode("profile_enrichment", profileEnrichment)
    .addNode("scoring", scoring)
    .addNode("path_router", pathRouter)
    .addNode("school_candidate_search", schoolData.schoolCandidateSearch)
    .addNode("evidence_retrieval", schoolData.evidenceRetrieval)
    .addNode("school_matching", schoolMatching)
    .addNode("hybrid_retrieval", rag.hybridRetrieval)
    .addNode("roadmap_generation", roadmapGeneration)
    .addNode("report_contract_generation", reportContractGeneration)
    .addNode("report_generation", rag.reportGeneration)
    .addNode("report_validation", reportValidation)
    .addNode("lead_score", leadScore)
    .addEdge(START, "profile_validation")
    .addEdge("profile_validation", "profile_enrichment")
    .addEdge("profile_enrichment", "scoring")
    .addEdge("scoring", "path_router")
    .addEdge("path_router", "school_candidate_search")
    .addEdge("school_candidate_search", "evidence_retrieval")
    .addEdge("evidence_retrieval", "school_matching")
    .addEdge("school_matching", "hybrid_retrieval")
    .addEdge("hybrid_retrieval", "roadmap_generation")
    .addEdge("roadmap_generation", "report_contract_generation")
    .addEdge("report_contract_generation", "report_generation")
    .addEdge("report_generation", "report_validation")
    .addEdge("report_validation", "lead_score")
    .addEdge("lead_score", END)
    .compile();
}

export const haiwenGraph = createHaiwenGraph();
