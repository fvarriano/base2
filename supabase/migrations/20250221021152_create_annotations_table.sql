create table public.annotations (
    id uuid not null default gen_random_uuid() primary key,
    frame_id uuid not null references public.frames(id) on delete cascade,
    number integer not null,
    x numeric not null,
    y numeric not null,
    text text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create RLS policies
alter table public.annotations enable row level security;

create policy "Enable read access for all users" on public.annotations
    for select using (true);

create policy "Enable insert for authenticated users only" on public.annotations
    for insert with check (auth.role() = 'authenticated');

create policy "Enable update for authenticated users only" on public.annotations
    for update using (auth.role() = 'authenticated');

create policy "Enable delete for authenticated users only" on public.annotations
    for delete using (auth.role() = 'authenticated');

-- Create updated_at trigger
create trigger handle_updated_at before update on public.annotations
    for each row execute function moddatetime('updated_at');
