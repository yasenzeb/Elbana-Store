if (req.method === 'POST') {
  const {
    name, type, price, image_url,
    discount_type, discount_value,
    sizes, colors, gallery, main_image_index
  } = req.body;

  if (!name || !type || !price) {
    return res.status(400).json({ success: false, error: 'name, type, and price are required.' });
  }

  const { data, error } = await supabase
    .from('products')
    .insert([{
      name,
      type,
      price:             parseInt(price),
      image_url:         image_url          || null,
      discount_type:     discount_type      || 'none',
      discount_value:    discount_value     || 0,
      sizes:             sizes              || [],
      colors:            colors             || [],
      gallery:           gallery            || [],
      main_image_index:  main_image_index   || 0,
    }])
    .select()
    .single();

  if (error) throw error;
  return res.status(201).json({ success: true, product: data });
}