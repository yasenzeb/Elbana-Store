if (req.method === 'PUT') {
  const {
    name, type, price, image_url,
    discount_type, discount_value,
    sizes, colors, gallery, main_image_index
  } = req.body || {};

  const updates = {};

  if (name              !== undefined) updates.name              = name;
  if (type              !== undefined) updates.type              = type;
  if (price             !== undefined) updates.price             = parseInt(price);
  if (image_url         !== undefined) updates.image_url         = image_url;
  if (discount_type     !== undefined) updates.discount_type     = discount_type;
  if (discount_value    !== undefined) updates.discount_value    = discount_type === 'none' ? 0 : parseFloat(discount_value) || 0;
  if (sizes             !== undefined) updates.sizes             = sizes;
  if (colors            !== undefined) updates.colors            = colors;
  if (gallery           !== undefined) updates.gallery           = gallery;
  if (main_image_index  !== undefined) updates.main_image_index  = main_image_index;

  if (updates.discount_type === 'none') updates.discount_value = 0;

  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return res.status(200).json({ success: true, product: data });
}