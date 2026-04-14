/**
 * LLM proxy route — allows the frontend to call InvokeLLM directly.
 */
import { Router, Response } from 'express';
import { invokeLLM } from '../services/llm.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.post('/llm/invoke', async (req: AuthRequest, res: Response) => {
  try {
    const { model, prompt, response_json_schema, maxTokens } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt required' });
    const result = await invokeLLM({ model: model || 'gemini_3_flash', prompt, response_json_schema, maxTokens });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
