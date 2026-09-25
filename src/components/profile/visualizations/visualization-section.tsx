import { VisualizationChart } from "@/components/profile/visualizations/visualization-chart";
import { getVisualizationDataset, rendererDefinitions, resolveAppearance, type VisualizationConfig } from "@/lib/visualization";
import type { PublicProfile } from "@/lib/types";

export function VisualizationSection({ profile, config }: { profile: PublicProfile; config: VisualizationConfig }) {
  const dataset = getVisualizationDataset(profile, config.dataset);
  const appearance = resolveAppearance(config.appearance);
  const signed = dataset.kind === "change";
  return <div data-visualization={config.renderer}>
    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#969287]">{dataset.sourceLabel}</p>
    <h2 className="mt-2 [font-family:Georgia,'Times_New_Roman',serif] text-2xl text-[#edeae0]">{dataset.label}</h2>
    <p className="mt-1 font-mono text-xs text-[#aaa69a]">{rendererDefinitions[config.renderer].label} · Aggregate activity</p>
    <div className="mt-5"><VisualizationChart dataset={dataset} config={config} /></div>
    {dataset.rows.length > 0 && <table className="mt-5 w-full table-fixed border-collapse text-left font-mono text-xs">
      <caption className="sr-only">{dataset.label} values in {dataset.unit === "%" ? "percent" : "lines"}</caption>
      <thead className="sr-only"><tr><th scope="col">{signed ? "Change" : "Language"}</th><th scope="col">{dataset.unit === "%" ? "Percent" : "Lines"}</th></tr></thead>
      <tbody>{dataset.rows.map((row, index) => <tr key={row.id} className="border-t border-[#34332c]">
        <th scope="row" className="w-2/3 break-words py-3 pr-2 font-normal text-[#c8c4b9]"><span aria-hidden="true" className="mr-2 inline-block size-2" style={{ backgroundColor: signed ? row.id === "removed" ? appearance.negative : appearance.positive : appearance.colors[index] }} />{row.label}</th>
        <td className="py-3 text-right tabular-nums text-[#edeae0]">{dataset.unit === "%" ? `${row.value.toFixed(1)}%` : row.value.toLocaleString("en-US")}</td>
      </tr>)}</tbody>
      {signed && <tfoot><tr className="border-t border-[#3b3931]"><th scope="row" className="py-3 font-normal text-[#c8c4b9]">Edit balance</th><td className="py-3 text-right text-[#edeae0]">{dataset.rows.reduce((sum, row) => sum + row.value, 0).toLocaleString("en-US")}</td></tr></tfoot>}
    </table>}
    <p className="mt-4 text-xs leading-5 text-[#969287]">{dataset.note}</p>
  </div>;
}
