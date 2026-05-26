/**
 * Symbol Learning Service
 * ========================
 * 
 * Stores user corrections to detected symbols and pre-fills future scans
 * with learned classifications. This creates a ground truth that improves
 * over time as the user refines detections.
 * 
 * Table: symbol_dictionary
 * - original_symbol: What Claude detected (e.g., "red circle")
 * - corrected_type: What the user corrected it to (e.g., "DOWNLIGHT_RECESSED")
 * - frequency: How many times this correction has been made
 * - last_used: When the user last verified this correction
 */

import { supabase } from "./supabaseClient";
import { ComponentType, DetectedComponent } from "../analyze_pdf";

export interface SymbolMapping {
  id?: string;
  original_symbol: string;           // "red filled circle" — what Claude detected
  corrected_type: ComponentType;      // What user corrected it to
  corrected_description?: string;    // e.g., "Recessed downlight 10W"
  frequency: number;                 // Times this correction was used
  last_used: string;                 // ISO timestamp
  tenant_id?: string;                // Multi-tenant support
}

export interface SymbolLearningResult {
  learned: boolean;
  suggestion?: string;
  confidence: number;                // 0–1, based on frequency
}

/**
 * Learn a correction: store what the user corrected
 * Called after user confirms/edits a detected symbol
 */
export async function learnSymbolCorrection(
  originalSymbol: string,
  correctedType: ComponentType,
  correctedDescription?: string,
  tenantId?: string
): Promise<SymbolMapping | null> {
  try {
    // Check if this mapping already exists
    const { data: existing } = await supabase
      .from("symbol_dictionary")
      .select("*")
      .eq("original_symbol", originalSymbol)
      .eq("corrected_type", correctedType)
      .eq("tenant_id", tenantId || null)
      .single();

    if (existing) {
      // Update frequency + last_used
      const { data } = await supabase
        .from("symbol_dictionary")
        .update({
          frequency: existing.frequency + 1,
          last_used: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();
      return data as SymbolMapping;
    } else {
      // Create new mapping
      const { data } = await supabase
        .from("symbol_dictionary")
        .insert({
          original_symbol: originalSymbol,
          corrected_type: correctedType,
          corrected_description: correctedDescription,
          frequency: 1,
          last_used: new Date().toISOString(),
          tenant_id: tenantId,
        })
        .select()
        .single();
      return data as SymbolMapping;
    }
  } catch (err) {
    console.error("[SymbolLearning] Failed to learn correction:", err);
    return null;
  }
}

/**
 * Suggest a correction based on learned history
 * Called during detection review to suggest "you corrected this to X last time"
 */
export async function suggestSymbolCorrection(
  originalSymbol: string,
  tenantId?: string
): Promise<SymbolLearningResult> {
  try {
    const { data } = await supabase
      .from("symbol_dictionary")
      .select("*")
      .eq("original_symbol", originalSymbol)
      .eq("tenant_id", tenantId || null)
      .order("frequency", { ascending: false })
      .limit(1)
      .single();

    if (!data) {
      return { learned: false, confidence: 0 };
    }

    // Confidence based on frequency (more uses = higher confidence)
    // E.g., 1 use = 0.3, 3 uses = 0.7, 5+ uses = 0.95
    const confidence = Math.min(1, 0.2 + (data.frequency * 0.15));

    return {
      learned: true,
      suggestion: data.corrected_type,
      confidence,
    };
  } catch (err) {
    console.error("[SymbolLearning] Failed to get suggestion:", err);
    return { learned: false, confidence: 0 };
  }
}

/**
 * Get all learned symbols for a tenant (useful for debugging/review)
 */
export async function getLearnedSymbols(
  tenantId?: string
): Promise<SymbolMapping[]> {
  try {
    const { data } = await supabase
      .from("symbol_dictionary")
      .select("*")
      .eq("tenant_id", tenantId || null)
      .order("frequency", { ascending: false });
    return (data || []) as SymbolMapping[];
  } catch (err) {
    console.error("[SymbolLearning] Failed to fetch learned symbols:", err);
    return [];
  }
}

/**
 * Delete a learned symbol (if user wants to reset)
 */
export async function deleteLearnedSymbol(id: string): Promise<boolean> {
  try {
    await supabase.from("symbol_dictionary").delete().eq("id", id);
    return true;
  } catch (err) {
    console.error("[SymbolLearning] Failed to delete:", err);
    return false;
  }
}

/**
 * Pre-fill detected components with learned suggestions
 * Call this after Claude detection, before showing to user
 */
export async function enrichWithLearnedSymbols(
  components: DetectedComponent[],
  tenantId?: string
): Promise<DetectedComponent[]> {
  const enriched = [...components];

  for (const component of enriched) {
    // Try to find a learned mapping for this original symbol
    if (component.symbol_visual) {
      const suggestion = await suggestSymbolCorrection(
        component.symbol_visual,
        tenantId
      );

      if (suggestion.learned) {
        // Add a flag that we have a learned suggestion
        component.flags = component.flags || [];
        if (!component.flags.includes("FROM_LEGEND")) {
          component.flags.push("FROM_LEGEND");
        }

        // Store the suggestion confidence for the UI to display
        (component as any).learned_suggestion = {
          type: suggestion.suggestion,
          confidence: suggestion.confidence,
        };
      }
    }
  }

  return enriched;
}
