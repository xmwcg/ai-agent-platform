import { type MediaGenParams, type MediaGenResult, type MediaProvider, type MediaTaskType } from '../media-gen.shared';
declare class MoneyPrinterTurboProvider implements MediaProvider {
    name: "moneyprinterturbo";
    label: string;
    supportedTypes: MediaTaskType[];
    private get baseURL();
    isConfigured(): boolean;
    generate(params: MediaGenParams): Promise<MediaGenResult>;
    queryTask(taskId: string): Promise<MediaGenResult>;
}
export { MoneyPrinterTurboProvider };
//# sourceMappingURL=moneyprinterturbo.provider.d.ts.map