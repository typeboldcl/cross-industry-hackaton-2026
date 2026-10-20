import type { MigrationInterface, QueryRunner } from "typeorm";

export class SeedCatalog1792520100000 implements MigrationInterface {
  name = "SeedCatalog1792520100000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO authority (code, name) VALUES
        ('SEA', 'Servicio de Evaluación Ambiental'),
        ('SMA', 'Superintendencia del Medio Ambiente'),
        ('SERNAPESCA', 'Servicio Nacional de Pesca y Acuicultura'),
        ('SUBPESCA', 'Subsecretaría de Pesca y Acuicultura'),
        ('SEREMI_SALUD', 'Secretaría Regional Ministerial de Salud'),
        ('DGA', 'Dirección General de Aguas'),
        ('SAG', 'Servicio Agrícola y Ganadero'),
        ('CMN', 'Consejo de Monumentos Nacionales'),
        ('DIRECTEMAR', 'Dirección General del Territorio Marítimo y de Marina Mercante')
      ON CONFLICT (code) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO facility (titular, kind, name, comuna)
      VALUES ('Invermar S.A.', 'piscicultura', 'Piscicultura Aucha', 'Calbuco')
      ON CONFLICT (titular, name) DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM facility WHERE titular = 'Invermar S.A.' AND name = 'Piscicultura Aucha'`,
    );
    await queryRunner.query(`DELETE FROM authority`);
  }
}
