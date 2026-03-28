<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class RequestAccessRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name'            => ['required', 'string', 'max:255'],
            'username'        => ['required', 'string', 'max:50', 'alpha_dash', 'unique:users,username'],
            'employee_id'     => ['required', 'string', 'max:50', 'unique:users,employee_id'],
            'phone'           => ['nullable', 'string', 'max:20'],
            'email'           => ['nullable', 'email', 'max:255'],
            'password'        => ['required', 'string', 'min:8', 'confirmed'],
            'organization_id' => ['required', 'exists:organizations,id'],
            'department_id'   => ['nullable', 'exists:departments,id'],
            'city'            => ['nullable', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required'            => 'Nama lengkap wajib diisi.',
            'username.required'        => 'Username wajib diisi.',
            'username.alpha_dash'      => 'Username hanya boleh huruf, angka, dash, dan underscore.',
            'username.unique'          => 'Username sudah digunakan.',
            'employee_id.required'     => 'Employee ID wajib diisi.',
            'employee_id.unique'       => 'Employee ID sudah terdaftar.',
            'password.required'        => 'Password wajib diisi.',
            'password.min'             => 'Password minimal 8 karakter.',
            'password.confirmed'       => 'Konfirmasi password tidak cocok.',
            'organization_id.required' => 'Organisasi wajib dipilih.',
            'organization_id.exists'   => 'Organisasi tidak ditemukan.',
            'department_id.exists'     => 'Department tidak ditemukan.',
        ];
    }
}