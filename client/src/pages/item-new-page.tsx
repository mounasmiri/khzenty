import { useNavigate } from 'react-router';

import { clothingApi } from '@/features/clothing/api';
import { ItemForm } from '@/features/clothing/item-form';

export function ItemNewPage() {
  const navigate = useNavigate();

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Add an item</h1>

      <ItemForm
        submitLabel="Add to wardrobe"
        onCancel={() => void navigate('/')}
        onSubmit={async (input) => {
          const created = await clothingApi.create(input);
          void navigate(`/items/${created.id}`, { replace: true });
        }}
      />
    </section>
  );
}
