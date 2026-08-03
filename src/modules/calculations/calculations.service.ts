import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ParametersService } from '../parameters/parameters.service';
import { CalculatedItem } from './dto';

interface CalculationInput {
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  ivaRate?: number;
  consumptionTaxRate?: number;
  feeRate?: number;
  feeIvaRate?: number;
  feeApplyOn?: 'base' | 'total_with_taxes';
  allyId?: string;
  tariffId?: string;
}

export interface EffectiveRates {
  ivaRate: number;
  consumptionTaxRate: number;
  feeRate: number;
  feeIvaRate: number;
  feeApplyOn: 'base' | 'total_with_taxes';
}

@Injectable()
export class CalculationsService {
  private readonly defaultFeeRate: number;
  private readonly defaultFeeIvaRate: number;
  private readonly feeApplyOn: 'base' | 'total_with_taxes';

  constructor(
    private readonly configService: ConfigService,
    private readonly parametersService: ParametersService,
  ) {
    this.defaultFeeRate = this.configService.get<number>('fee.rate', 0.0825);
    this.defaultFeeIvaRate = 0.19;
    this.feeApplyOn = this.configService.get<'base' | 'total_with_taxes'>('fee.applyOn', 'base');
  }

  async getActiveRates(): Promise<EffectiveRates> {
    const active = await this.parametersService.getActiveVersion();
    if (!active) {
      return {
        ivaRate: 0,
        consumptionTaxRate: 0,
        feeRate: this.defaultFeeRate,
        feeIvaRate: this.defaultFeeIvaRate,
        feeApplyOn: this.feeApplyOn,
      };
    }
    return {
      ivaRate: active.ivaRate,
      consumptionTaxRate: active.impuestoConsumoRate,
      feeRate: active.feeTarifadoRate,
      feeIvaRate: active.ivaFeeRate,
      feeApplyOn: active.applyFeeOnBase ? 'base' : 'total_with_taxes',
    };
  }

  calculateItem(input: CalculationInput): CalculatedItem {
    const baseValue = input.quantity * input.unitPrice;
    const ivaRate = input.ivaRate ?? 0;
    const consumptionTaxRate = input.consumptionTaxRate ?? 0;

    const ivaValue = baseValue * ivaRate;
    const consumptionTaxValue = baseValue * consumptionTaxRate;

    const feeRate = input.feeRate ?? this.defaultFeeRate;
    const feeIvaRate = input.feeIvaRate ?? this.defaultFeeIvaRate;

    const feeApplyOn = input.feeApplyOn ?? this.feeApplyOn;
    const feeBase = feeApplyOn === 'total_with_taxes'
      ? baseValue + ivaValue + consumptionTaxValue
      : baseValue;

    const feeValue = feeBase * feeRate;
    const feeIvaValue = feeValue * feeIvaRate;

    const totalValue = baseValue + ivaValue + consumptionTaxValue + feeValue + feeIvaValue;

    return {
      name: input.name,
      description: input.description,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      baseValue,
      ivaRate,
      ivaValue,
      consumptionTaxRate,
      consumptionTaxValue,
      feeRate,
      feeValue,
      feeIvaRate,
      feeIvaValue,
      totalValue,
      allyId: input.allyId,
      tariffId: input.tariffId,
    };
  }

  getEffectiveRates(): { feeRate: number; feeIvaRate: number; feeApplyOn: string } {
    return {
      feeRate: this.defaultFeeRate,
      feeIvaRate: this.defaultFeeIvaRate,
      feeApplyOn: this.feeApplyOn,
    };
  }
}
