import { makeVariantId } from "../utils/idMaker.js";
import { getStarterCode } from "./starterCode.js";
import { buildNarrative } from "./narrativeBuilder.js"
 
export function makeLanguageVariants({ problemId, languages, languageToStory, defaultStory, mode, topic, original }) {
  const variants = [];

  for (const language of languages) {
    const storyId = languageToStory[language] || defaultStory;

    const { templateId, narrative } = buildNarrative({
      storyId,
      mode,
      topic,
      problemId,
      originalTitle: original.title,
      originalDescription: original.description,
      language
    });

    variants.push({
      variantId: makeVariantId(problemId, language, storyId),
      language,
      storyId,
      templateId,
      narrative,
      starterCode: getStarterCode(language)
    });
  }

  return variants;
}
