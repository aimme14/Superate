function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function canonicalizeTopicName(subjectName: string, topicName: string): string {
  const normalizedSubject = normalizeText(subjectName);
  const normalizedTopic = normalizeText(topicName);

  if (normalizedSubject === 'lenguaje') {
    if (normalizedTopic.includes('literario')) return 'Textos literarios';
    if (normalizedTopic.includes('informativo')) return 'Textos informativos';
    if (normalizedTopic.includes('filosof')) return 'Textos filosoficos';
  }

  if (normalizedSubject.includes('social')) {
    if (
      normalizedTopic.includes('espacio') &&
      normalizedTopic.includes('territorio') &&
      normalizedTopic.includes('ambiente') &&
      normalizedTopic.includes('poblacion')
    ) {
      return 'El espacio, el territorio, el ambiente y la población';
    }
  }

  return topicName.trim();
}
