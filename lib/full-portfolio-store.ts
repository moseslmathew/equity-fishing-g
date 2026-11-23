import performanceExpansion from "../data/performance-fund-expansion.json";
import octoberRecheck from "../data/october-recheck.json";
import growwExpansion from "../data/groww-expansion.json";
import shortlistExpansion from "../data/shortlist-expansion.json";
import requestedFunds from "../data/requested-funds.json";
import whiteoakExpansion from "../data/whiteoak-expansion.json";
import expansion from "../data/fund-expansion-2026-10.json";
import september from "../data/september-portfolios.json";
import october from "../data/october-portfolios.json";
import seed from "../data/full-portfolio-seed.json";
import {ids} from "./portfolio";
import {validateFullComparison,type FullComparison} from "./full-portfolio";
export const fullKey=(month:string,fundId:string)=>"portfolio/full/"+month+"/"+fundId+".json";
export const bundledComparisons=[...seed,...september.comparisons,...expansion.comparisons,...october.comparisons,...performanceExpansion.comparisons,...octoberRecheck.comparisons,...whiteoakExpansion.comparisons,...growwExpansion.comparisons,...shortlistExpansion.comparisons,...requestedFunds.comparisons] as FullComparison[];
export async function readAllFullComparisons(_bucket?:R2Bucket):Promise<FullComparison[]> {return (await import("./database-store")).readDatabaseComparisons();}
export async function readFullComparisons(_bucket?:R2Bucket,month?:string):Promise<FullComparison[]> {return (await import("./database-store")).readDatabaseComparisons(month);}
