export default async function handler(req, res) {
  try {
    let body = req.body;

    // Corrige quando body vem como string
    if (typeof body === "string") {
      body = JSON.parse(body);
    }

    const query = body?.query || "";

    const url = `https://nikimba.com.br/wp-json/wc/v3/products?search=${query}&per_page=20&orderby=date&order=desc`;

    const auth = Buffer.from("ck_015309d814ed03a9e49759dc44a7cca3c52df1e1:cs_84ff1f5c68212a37d763c8c828866b5e322759c6").toString("base64");

    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`
      }
    });

   const data = await response.json();

// 🔍 DEBUG (MUITO IMPORTANTE)
console.log("RETORNO API:", data);

// Se não for array, retorna erro amigável
if (!Array.isArray(data)) {
  return res.status(200).json({
    erro: "Erro ao buscar produtos",
    detalhe: data
  });
}

const produtos = data.map(p => ({
  nome: p.name,
  preco: p.price,
  link: p.permalink,
  imagem: p.images?.[0]?.src
}));

    res.status(200).json({ produtos });

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro interno", detalhe: error.message });
  }
}
