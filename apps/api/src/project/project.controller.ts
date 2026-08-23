import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  changeProjectRoleRequestSchema,
  addProjectMemberRequestSchema,
  createProjectRequestSchema,
  updateProjectRequestSchema,
} from '@atlas/contracts';

import { AuthGuard, type AccessIdentity } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { parseWithSchema } from '../common/zod';
import { ProjectService } from './project.service';

@Controller('projects')
@UseGuards(AuthGuard)
export class ProjectController {
  constructor(private readonly projects: ProjectService) {}

  @Get()
  list(@CurrentUser() user: AccessIdentity, @Query('scope') scope?: string) {
    return this.projects.list(user.id, scope === 'discover' ? 'discover' : 'mine');
  }

  @Post()
  create(@CurrentUser() user: AccessIdentity, @Body() body: unknown) {
    return this.projects.create(user.id, parseWithSchema(createProjectRequestSchema, body));
  }

  @Get(':projectId')
  detail(@CurrentUser() user: AccessIdentity, @Param('projectId', new ParseUUIDPipe()) projectId: string) {
    return this.projects.detail(user.id, projectId);
  }

  @Patch(':projectId')
  update(@CurrentUser() user: AccessIdentity, @Param('projectId', new ParseUUIDPipe()) projectId: string, @Body() body: unknown) {
    return this.projects.update(user.id, projectId, parseWithSchema(updateProjectRequestSchema, body));
  }

  @Post(':projectId/follow')
  follow(@CurrentUser() user: AccessIdentity, @Param('projectId', new ParseUUIDPipe()) projectId: string) {
    return this.projects.follow(user.id, projectId);
  }

  @Delete(':projectId/follow')
  async unfollow(@CurrentUser() user: AccessIdentity, @Param('projectId', new ParseUUIDPipe()) projectId: string) {
    await this.projects.unfollow(user.id, projectId);
    return { ok: true };
  }

  @Patch(':projectId/members/:userId')
  changeRole(
    @CurrentUser() user: AccessIdentity,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('userId', new ParseUUIDPipe()) targetUserId: string,
    @Body() body: unknown,
  ) {
    const input = parseWithSchema(changeProjectRoleRequestSchema, body);
    return this.projects.changeRole(user.id, projectId, targetUserId, input.role);
  }

  @Post(':projectId/members')
  addMember(
    @CurrentUser() user: AccessIdentity,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() body: unknown,
  ) {
    const input = parseWithSchema(addProjectMemberRequestSchema, body);
    return this.projects.addFollower(user.id, projectId, input.userId);
  }
}
