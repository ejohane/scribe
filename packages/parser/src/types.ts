/**
 * Parser-specific types and interfaces.
 */

export interface ParserOptions {
  /**
   * Whether to extract frontmatter.
   */
  extractFrontmatter?: boolean;

  /**
   * Whether to extract inline tags.
   */
  extractTags?: boolean;

  /**
   * Whether to extract people mentions.
   */
  extractPeopleMentions?: boolean;

  /**
   * Custom person mention prefix (default: '@').
   */
  personMentionPrefix?: string;
}
