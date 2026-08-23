import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { createCollectionRequestSchema, updateCollectionRequestSchema } from '@atlas/contracts';

import { AuthGuard, type AccessIdentity } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { parseWithSchema } from '../common/zod';
import { CollectionService } from './collection.service';

@Controller('collections')
@UseGuards(AuthGuard)
export class CollectionController {
  constructor(private readonly collections: CollectionService) {}

  @Get()
  list(@CurrentUser() user: AccessIdentity) {
    return this.collections.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AccessIdentity, @Body() body: unknown) {
    return this.collections.create(user.id, parseWithSchema(createCollectionRequestSchema, body));
  }

  @Get(':collectionId')
  detail(@CurrentUser() user: AccessIdentity, @Param('collectionId', new ParseUUIDPipe()) collectionId: string) {
    return this.collections.detail(user.id, collectionId);
  }

  @Patch(':collectionId')
  update(
    @CurrentUser() user: AccessIdentity,
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @Body() body: unknown,
  ) {
    return this.collections.update(user.id, collectionId, parseWithSchema(updateCollectionRequestSchema, body));
  }

  @Delete(':collectionId')
  async remove(@CurrentUser() user: AccessIdentity, @Param('collectionId', new ParseUUIDPipe()) collectionId: string) {
    await this.collections.remove(user.id, collectionId);
    return { ok: true };
  }
}
