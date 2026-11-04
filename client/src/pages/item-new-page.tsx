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
        // Resolving with the created item is what lets the form attach a photo:
        // the confirm endpoint addresses the item by id, which does not exist
        // until this call returns.
        onSubmit={(input) => clothingApi.create(input)}
        onDone={(item) => void navigate(`/items/${item.id}`, { replace: true })}
      />
    </section>
  );
}
