// shared resource types
import { ActionMenuItem } from "@krumio/trailhand-ui/dist/components/action-menu/action-menu";

export interface ResourceTableAction {
    id: string;
    label: string;
    action: (row: any) => void;
}

export interface ResourceTableRowMeta {
    id: string;
    availableActions?: ActionMenuItem[];
}

export type ResourceTableRow = {
    [key: string]: any;
} & ResourceTableRowMeta;