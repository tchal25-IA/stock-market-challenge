import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ClaimDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(24)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Username: lettres, chiffres, underscore' })
  username!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Mot de passe: 8+ caractères avec lettres et chiffres',
  })
  password!: string;
}
