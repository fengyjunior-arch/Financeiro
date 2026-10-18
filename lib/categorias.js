// Pluggy categorizes in English with fine subcategories; the painel groups them into a few Portuguese ones.
const GRUPOS = [
  ['Mercado', /^(groceries|supermarket)/i],
  ['Alimentação', /food|eating out|restaurant|bar|coffee|delivery/i],
  ['Transporte', /transport|taxi|ride|uber|bus|subway|car rental|bicycle|automotive|gas station|fuel|parking|toll|vehicle|traffic/i],
  ['Assinaturas e digital', /digital services|streaming|gaming|software|app store/i],
  ['Compras', /shopping|electronics|clothing|kids|toys|bookstore|sports goods|office supplies|pet|department/i],
  ['Casa e contas', /housing|rent|utilities|water|electricity|^gas$|houseware|urban land|condominium/i],
  ['Telefone e internet', /telecom|internet|mobile|^tv$|cable/i],
  ['Saúde', /health|dentist|pharmacy|optometry|hospital|clinic|lab/i],
  ['Bem-estar', /wellness|fitness|gym|sports practice|beauty/i],
  ['Educação', /education|course|university|school|kindergarten/i],
  ['Viagem', /travel|airport|airline|accomodation|accommodation|hotel|mileage/i],
  ['Lazer', /leisure|tickets|stadium|landmark|museum|cinema|theater|concert|entertainment/i],
  ['Apostas e loterias', /gambling|lottery|bet/i],
  ['Impostos e tarifas', /tax|fee|bank fees|fines/i],
  ['Seguros', /insurance/i],
  ['Juros e empréstimos', /loan|financing|interest|overdraft|late payment/i],
  ['Doações', /donation/i],
  ['Pix e transferências', /transfer|pix|ted|doc\b|bank slip|boleto|alimony/i],
  ['Serviços', /services/i],
];

// When Pluggy leaves a purchase uncategorized, a few names are obvious enough to place by description.
const POR_DESCRICAO = [
  ['Transporte', /UBER|99APP|99 ?TAXI|POSTO|SHELL|IPIRANGA|ESTAPAR|SEM PARAR|VELOE/i],
  ['Alimentação', /IFD\*|IFOOD|RAPPI|RESTAUR|LANCH|PADARIA|BURGER|PIZZ|CAFE/i],
  ['Mercado', /MERCADO(?! ?LIVRE)|SUPERMERC|ATACAD|ASSAI|CARREFOUR|PAO DE ACUCAR/i],
  ['Compras', /SHOPEE|SHPP|MERCADOLIVRE|MERCADO ?LIVRE|AMAZON|ALIEXPRESS|MAGALU|SHEIN/i],
  ['Assinaturas e digital', /NETFLIX|SPOTIFY|YOUTUB|GOOGLE|APPLE\.COM|DISNEY|PRIME VIDEO|HBO|STEAM|OCULUS/i],
  ['Saúde', /DROGA|FARMA|RAIA|PAGUE MENOS/i],
  ['Apostas e loterias', /LOTERIA/i],
  ['Pix e transferências', /^PIX|TRANSF/i],
];

export function categoria(pluggyCategory, descricao = '') {
  const c = String(pluggyCategory ?? '').trim();
  if (c && !/^other/i.test(c)) {
    for (const [nome, re] of GRUPOS) if (re.test(c)) return nome;
  }
  for (const [nome, re] of POR_DESCRICAO) if (re.test(descricao)) return nome;
  return 'Outros';
}
