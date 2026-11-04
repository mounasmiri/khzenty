import { useNavigate, useParams } from 'react-router';

import { clothingApi } from '@/features/clothing/api';
import { ItemForm } from '@/features/clothing/item-form';
import { useClothingItem } from '@/features/clothing/use-wardrobe';

export function ItemEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { item, error, loading } = useClothingItem(id);

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (error || !item) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {error ?? 'Item not found.'}
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Edit item</h1>

      <ItemForm
        item={item}
        submitLabel="Save changes"
        onCancel={() => void navigate(`/items/${item.id}`)}
        onSubmit={(input) => clothingApi.update(item.id, input)}
        onDone={(saved) => void navigate(`/items/${saved.id}`, { replace: true })}
      />
    </section>
  );
}
