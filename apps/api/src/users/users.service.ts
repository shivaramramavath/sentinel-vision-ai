import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserRole } from './schemas/user.schema';
import { StorageService } from '../common/storage/storage.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @Optional()
    private readonly storageService?: StorageService,
  ) {}

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async create(data: {
    email: string;
    passwordHash: string;
    fullName: string;
    badgeNumber?: string;
    role?: UserRole;
    department?: string;
  }): Promise<UserDocument> {
    const user = new this.userModel({
      ...data,
      email: data.email.toLowerCase(),
    });
    return user.save();
  }

  async findAll(): Promise<UserDocument[]> {
    return this.userModel.find().select('-passwordHash').exec();
  }

  async updateAvatar(userId: string, buffer: Buffer, mimeType: string): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    if (this.storageService) {
      const asset = await this.storageService.upload({
        buffer,
        kind: 'avatar',
        entityId: userId,
        mimeType,
        uploadedBy: user.email,
        context: { userId },
        tags: ['avatar', 'user'],
      });

      const signed = await this.storageService.getSignedUrl(asset.assetId, { purpose: 'view' });
      user.avatarUrl = signed.url;
    } else {
      user.avatarUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
    }

    return user.save();
  }
}
