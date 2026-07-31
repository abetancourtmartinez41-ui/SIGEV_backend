export interface CalculatedItem {
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  baseValue: number;
  ivaRate: number;
  ivaValue: number;
  consumptionTaxRate: number;
  consumptionTaxValue: number;
  feeRate: number;
  feeValue: number;
  feeIvaRate: number;
  feeIvaValue: number;
  totalValue: number;
  allyId?: string;
  tariffId?: string;
}
