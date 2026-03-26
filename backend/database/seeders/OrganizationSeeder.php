<?php

namespace Database\Seeders;

use App\Models\Organization;
use Illuminate\Database\Seeder;

class OrganizationSeeder extends Seeder
{
    /**
     * Seed the default organization.
     */
    public function run(): void
    {
        Organization::firstOrCreate(
            ['slug' => 'lembaga-amil-zakat'],
            [
                'name'        => 'Nurul Hayat',
                'slug'        => 'lembaga-amil-zakat',
                'description' => 'Lembaga Amil Zakat Nurul Hayat',
                'is_active'   => true,
            ]
        );

        $this->command->info('✅ Organization seeded: Nurul Hayat');
    }
}