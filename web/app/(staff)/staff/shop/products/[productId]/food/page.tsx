'use client';

import { use, useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { FoodDetailsForm } from '@/components/staff-shop/FoodDetailsForm';
import { setFoodDetails } from '@/lib/api/staff-shop';
import { useStaffProduct, useTwoStepSave } from '@/lib/hooks/useStaffShop';

/**
 * `/staff/shop/products/[productId]/food` — food & labelling (US-SHP-03). Food only (U-D2).
 * Saves the labelling; the form is keyed only by an explicit Reload, so a refused save keeps what
 * was typed (NFR-USA-5).
 */
export default function ProductFoodPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = use(params);
  const product = useStaffProduct(productId);
  const twoStep = useTwoStepSave(productId);
  const [formKey, setFormKey] = useState(0);
  const p = product.data;
  if (!p) return <LoadingState rows={8} />;
  if (p.category !== 'CatFood' || p.kind !== 'Standard') {
    return (
      <EmptyState
        title="Food details don't apply to this product"
        description="Only standard food products have labelling."
      />
    );
  }
  return (
    <FoodDetailsForm
      key={formKey}
      product={p}
      onReload={() => {
        // Only a successful refetch brings new values to show; after a failed one the typed
        // values stay (S13).
        void product.refetch().then((result) => {
          if (result.isSuccess) setFormKey((k) => k + 1);
        });
      }}
      onSave={(v) => {
        const analysis =
          v.proteinPercent === ''
            ? null
            : {
                proteinPercent: Number(v.proteinPercent),
                fatPercent: Number(v.fatPercent),
                fibrePercent: Number(v.fibrePercent),
                moisturePercent: Number(v.moisturePercent),
              };
        return twoStep(
          () =>
            setFoodDetails(productId, {
              expectedVersion: p.version,
              manufacturer: v.manufacturer || null,
              proteinSource: v.proteinSource || null,
              ingredientList: v.ingredientList || null,
              guaranteedAnalysis: analysis,
              feedingGuide: v.feedingGuide || null,
              storageInstructions: v.storageInstructions || null,
            }),
          null,
          'Labelling saved',
        );
      }}
    />
  );
}
