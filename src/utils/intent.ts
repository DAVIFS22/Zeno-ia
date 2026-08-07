export const detectIntent = (input: string): 'image' | 'text' => {
  const normalized = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, ' ')
    .trim();

  const imageKeywordsPattern = /(gere uma imagem|criar imagem|crie uma imagem|desenhe|faca uma ilustracao|renderize|gerar arte|criar arte|criar logo|criar wallpaper|editar imagem|editar foto|transformar imagem|melhorar imagem|remover fundo|restaurar foto|upscale|generate image|create image|generar imagen|crear imagen|dibuja|fais une image|creer une image|dessine|生成图片|创建图片|画一个)/i;
  const singleWordPattern = /\b(image|draw|imagen|dibujar|dessiner|图片|绘画)\b/i;

  if (imageKeywordsPattern.test(normalized) || singleWordPattern.test(normalized)) {
    return 'image';
  }
  
  return 'text';
};
