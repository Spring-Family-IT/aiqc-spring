-- Create products table for main product information
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  communication_no TEXT,
  material TEXT,
  product_version_no TEXT,
  name_of_dependency TEXT,
  finished_goods_material_number TEXT,
  super_theme TEXT,
  geography TEXT,
  ean_upc TEXT,
  product_age_classification TEXT,
  piece_count_of_fg INTEGER,
  global_launch_date DATE,
  marketing_exit_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create product_components table for component/BOM details
CREATE TABLE public.product_components (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  material_group TEXT,
  component TEXT,
  component_description TEXT,
  design_raw_material TEXT,
  super_design TEXT,
  pack_print_orientation TEXT,
  packaging_sublevel TEXT,
  bom_quantity TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_components ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for products
CREATE POLICY "Users can view their own products" 
ON public.products 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own products" 
ON public.products 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own products" 
ON public.products 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own products" 
ON public.products 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for product_components
CREATE POLICY "Users can view components of their own products" 
ON public.product_components 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.products 
    WHERE products.id = product_components.product_id 
    AND products.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create components for their own products" 
ON public.product_components 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products 
    WHERE products.id = product_components.product_id 
    AND products.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update components of their own products" 
ON public.product_components 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.products 
    WHERE products.id = product_components.product_id 
    AND products.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete components of their own products" 
ON public.product_components 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.products 
    WHERE products.id = product_components.product_id 
    AND products.user_id = auth.uid()
  )
);

-- Create indexes for better performance
CREATE INDEX idx_products_user_id ON public.products(user_id);
CREATE INDEX idx_products_communication_no ON public.products(communication_no);
CREATE INDEX idx_product_components_product_id ON public.product_components(product_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_components_updated_at
BEFORE UPDATE ON public.product_components
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();