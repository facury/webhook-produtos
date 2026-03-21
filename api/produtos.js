export default async function handler(req, res) {
  const query = req.body?.query || "";

  const url = `https://nikimba.com.br/wp-json/wc/v3/products?search=${query}&per_page=3`;

  const auth = Buffer.from("SUA_CONSUMER_KEY:SUA_CONSUMER_SECRET").toString("base64");

  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`
    }
  });

  const data = await response.json();

  const produtos = data.map(p => ({
    nome: p.name,
    preco: p.price,
    link: p.permalink,
    imagem: p.images?.[0]?.src
  }));

  res.status(200).json({ produtos });
}