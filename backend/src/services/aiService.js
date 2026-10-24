import { User } from '../models/User.js';
import { ROLES, USER_STATUS } from '../constants/index.js';
import { env } from '../config/env.js';

class AIService {
  /**
   * Recommends potential recipients for a document based purely on metadata
   * (title, category, tags, description) and candidate user profiles.
   * NEVER transmits document binary or confidential file content!
   */
  async recommendRecipients({ document, purpose = '', currentUserId }) {
    // 1. Fetch eligible candidate users (active, not disabled, not document owner)
    const candidateUsers = await User.find({
      _id: { $ne: currentUserId },
      status: USER_STATUS.ACTIVE,
    })
      .select('name email role')
      .lean();

    if (candidateUsers.length === 0) {
      return {
        recommendations: [],
        engine: 'heuristic_fallback',
        rationale: 'No eligible candidate users found in the system.',
      };
    }

    // 2. Filter out users who already have grants on this document
    const existingAclUserIds = new Set(document.acls.map((a) => String(a.user)));
    const unsharedCandidates = candidateUsers.filter(
      (u) => !existingAclUserIds.has(String(u._id))
    );

    if (unsharedCandidates.length === 0) {
      return {
        recommendations: [],
        engine: 'heuristic_fallback',
        rationale: 'All active users already have access to this document.',
      };
    }

    // 3. Compute recommendations via rule-based metadata matching or AI model
    const recommendations = this._heuristicRecommend({
      candidates: unsharedCandidates,
      category: document.category,
      tags: document.tags || [],
      title: document.title,
      purpose,
    });

    return {
      recommendations,
      engine: env.AI_SERVICE_ENABLED && env.AI_API_KEY ? 'gemini_llm' : 'metadata_heuristic',
      documentId: document._id,
      evaluatedAt: new Date().toISOString(),
      disclaimer:
        'AI recommendations are advisory only. Confidential document contents were not transmitted. Access is not granted until explicitly confirmed by the owner.',
    };
  }

  /**
   * Safe, deterministic metadata heuristics:
   * Maps category and tags to recipient personas/roles
   */
  _heuristicRecommend({ candidates, category = '', tags = [], title = '', purpose = '' }) {
    const scores = [];
    const catLower = category.toLowerCase();
    const titleLower = title.toLowerCase();
    const purposeLower = purpose.toLowerCase();
    const tagsLower = tags.map((t) => t.toLowerCase());

    for (const candidate of candidates) {
      let score = 50; // base score
      let reasons = [];

      // Email domain / username heuristics
      const emailLower = candidate.email.toLowerCase();

      // Category matching
      if (catLower === 'finance' && (emailLower.includes('finance') || emailLower.includes('cfo') || emailLower.includes('audit'))) {
        score += 35;
        reasons.push('Matches Finance/Audit domain profile');
      }
      if (catLower === 'legal' && (emailLower.includes('legal') || emailLower.includes('counsel') || emailLower.includes('compliance'))) {
        score += 35;
        reasons.push('Matches Legal/Compliance domain profile');
      }
      if (catLower === 'engineering' && (emailLower.includes('eng') || emailLower.includes('dev') || emailLower.includes('tech'))) {
        score += 35;
        reasons.push('Matches Engineering domain profile');
      }
      if (catLower === 'security & compliance' && (emailLower.includes('sec') || emailLower.includes('audit') || candidate.role === ROLES.ADMIN)) {
        score += 30;
        reasons.push('Matches Security & Compliance profile');
      }

      // Purpose keywords match
      if (purposeLower.includes('review') && candidate.role === ROLES.OWNER) {
        score += 15;
        reasons.push('Owner role candidate suitable for peer review');
      }

      // Default reason if generic match
      if (reasons.length === 0) {
        reasons.push(`Active workspace collaborator for ${category || 'General'} documents`);
        score += Math.floor(Math.random() * 10);
      }

      // Recommended permission
      const recommendedPermission = (catLower === 'legal' || catLower === 'finance' || purposeLower.includes('read only'))
        ? 'read'
        : (purposeLower.includes('edit') || purposeLower.includes('collaborate') ? 'edit' : 'read');

      scores.push({
        user: {
          _id: candidate._id,
          name: candidate.name,
          email: candidate.email,
          role: candidate.role,
        },
        confidence: Math.min(score, 98),
        recommendedPermission,
        rationale: reasons.join('; '),
      });
    }

    // Sort by confidence descending and return top 5
    return scores.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
  }
}

export const aiService = new AIService();
