import { All, Controller, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpService } from './mcp.service';

/**
 * POST /mcp — 외부 Claude 세션이 붙는 MCP 엔드포인트.
 * stateless 모드: 요청마다 새 server+transport (로컬 단일 사용자 전제).
 *
 * 외부 프로젝트의 .mcp.json:
 *   { "mcpServers": { "issue-board": { "type": "http", "url": "http://localhost:4000/mcp" } } }
 */
@Controller('mcp')
export class McpController {
  constructor(private readonly mcp: McpService) {}

  @All()
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    const server = this.mcp.createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    });

    res.on('close', () => {
      void transport.close();
      void server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }
}
